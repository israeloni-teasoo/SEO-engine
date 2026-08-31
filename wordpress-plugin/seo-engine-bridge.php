<?php
/**
 * Plugin Name: SEO Engine Bridge
 * Description: Exposes neutral SEO meta fields to the WordPress REST API and maps
 *              them onto whichever SEO plugin is active (Yoast, Rank Math, or All
 *              in One SEO). Lets the SEO Engine app write SEO title, meta
 *              description, focus keyphrase, and secondary keyphrases when
 *              publishing. Also resolves tags/categories by name automatically
 *              via core REST endpoints.
 * Version:     1.0.0
 * Author:      SEO Engine
 * License:     MIT
 *
 * Install: copy this file to wp-content/mu-plugins/ (create the folder if needed)
 * for an always-on must-use plugin, or to wp-content/plugins/ and activate it.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const SEO_ENGINE_META_KEYS = array(
	'seo_engine_title',
	'seo_engine_description',
	'seo_engine_focus_keyphrase',
	'seo_engine_secondary_keyphrases',
);

/**
 * Register the neutral meta keys so they can be written via /wp/v2/posts `meta`.
 */
add_action( 'init', function () {
	foreach ( SEO_ENGINE_META_KEYS as $key ) {
		register_post_meta( 'post', $key, array(
			'type'          => 'string',
			'single'        => true,
			'show_in_rest'  => true,
			'auth_callback' => function () {
				return current_user_can( 'edit_posts' );
			},
		) );
	}
} );

/**
 * Detect which supported SEO plugin is active.
 */
function seo_engine_detect_plugin() {
	if ( defined( 'WPSEO_VERSION' ) || class_exists( 'WPSEO_Options' ) ) {
		return 'yoast';
	}
	if ( class_exists( 'RankMath' ) ) {
		return 'rankmath';
	}
	if ( function_exists( 'aioseo' ) ) {
		return 'aioseo';
	}
	return null;
}

/**
 * After a post is created or updated via REST, copy the neutral meta into the
 * active SEO plugin's own fields.
 */
add_action( 'rest_after_insert_post', function ( $post, $request ) {
	seo_engine_sync_meta( $post->ID );
}, 10, 2 );

// Fallback for non-REST saves that still carry the neutral meta.
add_action( 'save_post_post', function ( $post_id ) {
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}
	seo_engine_sync_meta( $post_id );
}, 20 );

function seo_engine_sync_meta( $post_id ) {
	$title       = (string) get_post_meta( $post_id, 'seo_engine_title', true );
	$description = (string) get_post_meta( $post_id, 'seo_engine_description', true );
	$focus       = (string) get_post_meta( $post_id, 'seo_engine_focus_keyphrase', true );
	$secondary_raw = (string) get_post_meta( $post_id, 'seo_engine_secondary_keyphrases', true );

	// Nothing to do if the app didn't send any SEO meta.
	if ( '' === $title && '' === $description && '' === $focus && '' === $secondary_raw ) {
		return;
	}

	$secondary = array_filter( array_map( 'trim', explode( ',', $secondary_raw ) ) );
	$plugin    = seo_engine_detect_plugin();

	if ( 'yoast' === $plugin ) {
		if ( '' !== $title ) {
			update_post_meta( $post_id, '_yoast_wpseo_title', $title );
		}
		if ( '' !== $description ) {
			update_post_meta( $post_id, '_yoast_wpseo_metadesc', $description );
		}
		if ( '' !== $focus ) {
			update_post_meta( $post_id, '_yoast_wpseo_focuskw', $focus );
		}
		if ( ! empty( $secondary ) ) {
			// Yoast Premium stores extra keyphrases as JSON [{keyword, score}].
			$payload = array_map( function ( $kw ) {
				return array( 'keyword' => $kw, 'score' => null );
			}, array_values( $secondary ) );
			update_post_meta( $post_id, '_yoast_wpseo_focuskeywords', wp_json_encode( $payload ) );
		}
	} elseif ( 'rankmath' === $plugin ) {
		if ( '' !== $title ) {
			update_post_meta( $post_id, 'rank_math_title', $title );
		}
		if ( '' !== $description ) {
			update_post_meta( $post_id, 'rank_math_description', $description );
		}
		// Rank Math keeps primary + secondary in one comma-separated field.
		$keywords = array_values( array_filter( array_merge( array( $focus ), $secondary ) ) );
		if ( ! empty( $keywords ) ) {
			update_post_meta( $post_id, 'rank_math_focus_keyword', implode( ',', $keywords ) );
		}
	} elseif ( 'aioseo' === $plugin ) {
		seo_engine_sync_aioseo( $post_id, $title, $description, $focus, $secondary );
	}
}

/**
 * All in One SEO stores its data in a custom table, not post meta, so it needs
 * its own model.
 */
function seo_engine_sync_aioseo( $post_id, $title, $description, $focus, $secondary ) {
	if ( ! class_exists( '\AIOSEO\Plugin\Common\Models\Post' ) ) {
		return;
	}
	$aioseo_post = \AIOSEO\Plugin\Common\Models\Post::getPost( $post_id );
	if ( ! $aioseo_post ) {
		return;
	}
	if ( '' !== $title ) {
		$aioseo_post->title = $title;
	}
	if ( '' !== $description ) {
		$aioseo_post->description = $description;
	}
	if ( '' !== $focus || ! empty( $secondary ) ) {
		$aioseo_post->keyphrases = wp_json_encode( array(
			'focus'      => array( 'keyphrase' => $focus ),
			'additional' => array_map( function ( $kw ) {
				return array( 'keyphrase' => $kw );
			}, array_values( $secondary ) ),
		) );
	}
	$aioseo_post->post_id = $post_id;
	$aioseo_post->save();
}

/**
 * Status endpoint so the app can confirm the bridge is installed and report which
 * SEO plugin it detected. GET /wp-json/seo-engine/v1/status
 */
add_action( 'rest_api_init', function () {
	register_rest_route( 'seo-engine/v1', '/status', array(
		'methods'             => 'GET',
		'permission_callback' => function () {
			return current_user_can( 'edit_posts' );
		},
		'callback'            => function () {
			return array(
				'ok'         => true,
				'version'    => '1.0.0',
				'seo_plugin' => seo_engine_detect_plugin(),
			);
		},
	) );
} );
