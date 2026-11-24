<?php
/**
 * Plugin Name: JazzHR Jobs Integration
 * Description: Fetches open jobs from JazzHR and exposes them through a WordPress REST API.
 * Version: 1.0.1
 * Author: Umer Irshad
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * ---------------------------------------------------------
 * CONFIGURATION
 * ---------------------------------------------------------
 *
 * Add this to wp-config.php instead of putting the API key
 * directly into this plugin file:
 *
 * define( 'JAZZHR_API_KEY', 'YOUR_JAZZHR_API_KEY' );
 *
 */

if ( ! defined( 'JAZZHR_API_KEY' ) ) {
	define( 'JAZZHR_API_KEY', '' );
}

define( 'JAZZHR_API_BASE', 'https://api.resumatorapi.com/v1' );
define( 'JAZZHR_CACHE_KEY', 'jazzhr_open_jobs_v1' );
define( 'JAZZHR_CACHE_TIME', 15 * MINUTE_IN_SECONDS );
define( 'JAZZHR_CACHE_LOCK_TIME', 30 );


/**
 * ---------------------------------------------------------
 * ENQUEUE FRONTEND ASSETS
 * ---------------------------------------------------------
 */
function jazzhr_enqueue_assets() {

	if ( ! is_page( 'job-board' ) ) {
		return;
	}

	$plugin_path = plugin_dir_path( __FILE__ );
	$plugin_url  = plugin_dir_url( __FILE__ );

	$css_path = $plugin_path . 'assets/jazzhr-jobs.css';
	$js_path  = $plugin_path . 'assets/jazzhr-jobs.js';


	wp_enqueue_style(
		'jazzhr-jobs',
		$plugin_url . 'assets/jazzhr-jobs.css',
		array(),
		file_exists( $css_path ) ? filemtime( $css_path ) : null
	);


	wp_enqueue_script(
		'jazzhr-jobs',
		$plugin_url . 'assets/jazzhr-jobs.js',
		array(),
		file_exists( $js_path ) ? filemtime( $js_path ) : null,
		true
	);


	wp_localize_script(
		'jazzhr-jobs',
		'JazzHRJobs',
		array(
			'apiUrl' => esc_url_raw(
				rest_url( 'jazzhr/v1/jobs' )
			),
		)
	);
}

add_action(
	'wp_enqueue_scripts',
	'jazzhr_enqueue_assets'
);


/**
 * ---------------------------------------------------------
 * FETCH JOBS FROM JAZZHR
 * ---------------------------------------------------------
 */
function jazzhr_get_jobs_from_api() {

	if ( empty( JAZZHR_API_KEY ) ) {
		return new WP_Error(
			'jazzhr_missing_api_key',
			'JazzHR API key is not configured.',
			array( 'status' => 500 )
		);
	}

	/**
	 * Try cached jobs first.
	 */
	$cached_jobs = get_transient( JAZZHR_CACHE_KEY );

	if ( false !== $cached_jobs ) {
		return $cached_jobs;
	}

	/*
	 * Prevent concurrent public requests from all requesting the upstream API
	 * when the cache is cold. The lock is deliberately short-lived so a failed
	 * request cannot block the job board for an extended period.
	 */
	if ( get_transient( JAZZHR_CACHE_KEY . '_lock' ) ) {
		return new WP_Error(
			'jazzhr_refresh_in_progress',
			'Jobs are temporarily unavailable. Please try again shortly.',
			array( 'status' => 503 )
		);
	}

	set_transient(
		JAZZHR_CACHE_KEY . '_lock',
		1,
		JAZZHR_CACHE_LOCK_TIME
	);

	/**
	 * JazzHR endpoint for open jobs.
	 *
	 * Your previous API testing used:
	 * /v1/jobs/title/{title}/status/open
	 *
	 * Here we request all open jobs.
	 */
    $url = add_query_arg(
        array(
            'apikey' => JAZZHR_API_KEY,
        ),
        JAZZHR_API_BASE . '/jobs/status/open'
    );

	$response = wp_remote_get(
		$url,
		array(
			'timeout' => 20,
			'headers' => array(
				'Accept' => 'application/json',
			),
		)
	);

	/**
	 * Request-level error.
	 */
	if ( is_wp_error( $response ) ) {
		delete_transient( JAZZHR_CACHE_KEY . '_lock' );

		return new WP_Error(
			'jazzhr_request_failed',
			'Unable to connect to JazzHR.',
			array( 'status' => 502 )
		);
	}

	$status_code = wp_remote_retrieve_response_code( $response );
	$body        = wp_remote_retrieve_body( $response );

	/**
	 * JazzHR returned an error.
	 */
	if ( $status_code < 200 || $status_code >= 300 ) {
		delete_transient( JAZZHR_CACHE_KEY . '_lock' );

		return new WP_Error(
			'jazzhr_api_error',
			'JazzHR API returned an error.',
			array( 'status' => 502 )
		);
	}

	$data = json_decode( $body, true );

	if ( null === $data && JSON_ERROR_NONE !== json_last_error() ) {
		delete_transient( JAZZHR_CACHE_KEY . '_lock' );

		return new WP_Error(
			'jazzhr_invalid_json',
			'JazzHR returned invalid JSON.',
			array(
				'status' => 502,
			)
		);
	}

	if ( ! is_array( $data ) ) {
		delete_transient( JAZZHR_CACHE_KEY . '_lock' );

		return new WP_Error(
			'jazzhr_invalid_response',
			'JazzHR returned an unexpected response.',
			array( 'status' => 502 )
		);
	}

	/**
	 * Some APIs return the jobs directly as an array.
	 * Keep this flexible in case JazzHR wraps them.
	 */
	if ( isset( $data['jobs'] ) && is_array( $data['jobs'] ) ) {
		$jobs = $data['jobs'];
	} elseif ( jazzhr_is_list( $data ) ) {
		$jobs = $data;
	} else {
		$jobs = array();
	}

	$jobs = array_values(
		array_filter(
			$jobs,
			'is_array'
		)
	);

	/**
	 * Normalize jobs before caching.
	 */
	$jobs = array_map(
		'jazzhr_normalize_job',
		$jobs
	);

	/**
	 * Remove invalid entries.
	 */
	$jobs = array_values(
		array_filter(
			$jobs,
			function ( $job ) {
				return ! empty( $job['title'] );
			}
		)
	);

	delete_transient( JAZZHR_CACHE_KEY . '_lock' );

	/**
	 * Cache for 15 minutes.
	 */
	set_transient(
		JAZZHR_CACHE_KEY,
		$jobs,
		JAZZHR_CACHE_TIME
	);

	return $jobs;
}

/**
 * Determine whether an array has sequential numeric keys.
 *
 * @param mixed $value Value to inspect.
 * @return bool
 */
function jazzhr_is_list( $value ) {

	if ( ! is_array( $value ) ) {
		return false;
	}

	$expected_key = 0;

	foreach ( array_keys( $value ) as $key ) {
		if ( $key !== $expected_key ) {
			return false;
		}

		$expected_key++;
	}

	return true;
}



/**
 * ---------------------------------------------------------
 * NORMALIZE JAZZHR JOB
 * ---------------------------------------------------------
 */
function jazzhr_normalize_job( $job ) {

	$get_value = function ( $keys ) use ( $job ) {
		foreach ( $keys as $key ) {
			if (
				isset( $job[ $key ] ) &&
				is_scalar( $job[ $key ] ) &&
				'' !== $job[ $key ]
			) {
				return $job[ $key ];
			}
		}

		return '';
	};

	// Job ID
	$id = $get_value(
		array(
			'id',
			'job_id',
			'jobId',
		)
	);

	// Job title
	$title = $get_value(
		array(
			'title',
			'job_title',
			'name',
		)
	);

	// City
	$city = $get_value(
		array(
			'city',
			'location_city',
		)
	);

	// State
	$state = $get_value(
		array(
			'state',
			'state_name',
			'location_state',
		)
	);

	// ZIP
	$zip = $get_value(
		array(
			'zip',
			'zipcode',
			'postal_code',
		)
	);

	// Description
	$description = $get_value(
		array(
			'description',
			'job_description',
			'content',
		)
	);

	// JazzHR board code
	$board_code = $get_value(
		array(
			'board_code',
		)
	);

	/*
	 * Build the public JazzHR job URL.
	 *
	 * Example:
	 * https://advancedprofessionalsecurity.applytojob.com/apply/DFZ85DBc4K/031107-Armed-Security-Guard-Ft-Collins
	 */

	$job_url = '';

	if ( $board_code && $title ) {

		$slug = trim( $title );

		// Remove surrounding parentheses.
		$slug = preg_replace( '/^\(([^)]+)\)\s*/', '$1-', $slug );

		// Convert HTML entities.
		$slug = html_entity_decode(
			$slug,
			ENT_QUOTES | ENT_HTML5,
			'UTF-8'
		);

		// Replace ampersand with "and".
		$slug = str_replace( '&', 'and', $slug );

		// Replace non-alphanumeric characters with hyphens.
		$slug = preg_replace( '/[^A-Za-z0-9]+/', '-', $slug );

		// Remove duplicate hyphens.
		$slug = preg_replace( '/-+/', '-', $slug );

		// Remove leading/trailing hyphens.
		$slug = trim( $slug, '-' );

		$job_url = sprintf(
			'https://advancedprofessionalsecurity.applytojob.com/apply/%s/%s',
			rawurlencode( $board_code ),
			$slug
		);
	}

	// Build location.
	$location = '';

	if ( $city && $state ) {
		$location = $city . ', ' . $state;
	} elseif ( $city ) {
		$location = $city;
	} elseif ( $state ) {
		$location = $state;
	}

	return array(
		'id' => sanitize_text_field(
			(string) $id
		),

		'title' => sanitize_text_field(
			(string) $title
		),

		'location' => sanitize_text_field(
			(string) $location
		),

		'city' => sanitize_text_field(
			(string) $city
		),

		'state' => sanitize_text_field(
			(string) $state
		),

		'zip' => sanitize_text_field(
			(string) $zip
		),

		'description' => wp_kses_post(
			(string) $description
		),

		'board_code' => sanitize_text_field(
			(string) $board_code
		),

		'job_url' => esc_url_raw(
			$job_url
		),
	);
}

/**
 * ---------------------------------------------------------
 * REST API ENDPOINT
 * ---------------------------------------------------------
 *
 * /wp-json/jazzhr/v1/jobs
 */
function jazzhr_register_rest_routes() {

	register_rest_route(
		'jazzhr/v1',
		'/jobs',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'jazzhr_rest_get_jobs',
			'permission_callback' => '__return_true',
		)
	);
}

add_action(
	'rest_api_init',
	'jazzhr_register_rest_routes'
);


/**
 * REST API callback.
 */
function jazzhr_rest_get_jobs( WP_REST_Request $request ) {

	$jobs = jazzhr_get_jobs_from_api();

	if ( is_wp_error( $jobs ) ) {
		return $jobs;
	}

	return rest_ensure_response(
		array(
			'success' => true,
			'count'   => count( $jobs ),
			'jobs'    => $jobs,
		)
	);
}


/**
 * ---------------------------------------------------------
 * CLEAR CACHE
 * ---------------------------------------------------------
 *
 * Useful when you want to force a fresh JazzHR request.
 */
function jazzhr_clear_jobs_cache() {
	delete_transient( JAZZHR_CACHE_KEY );
	delete_transient( JAZZHR_CACHE_KEY . '_lock' );
}
