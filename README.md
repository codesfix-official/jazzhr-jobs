# JazzHR Jobs Integration

A lightweight WordPress plugin that fetches open jobs from JazzHR and displays them in a frontend job board.

## What the plugin does

- Connects to the JazzHR v1 API using a server-side API key.
- Retrieves open jobs from JazzHR.
- Normalizes job titles, locations, IDs, and application URLs.
- Caches successful API results for 15 minutes.
- Provides the jobs through a public WordPress REST endpoint.
- Displays jobs with frontend JavaScript.
- Supports state filtering and pagination.
- Opens each job's JazzHR application page in a new tab.

The plugin does not create a shortcode or automatically create the frontend HTML container. The required markup must be added to a WordPress page or template.

## Requirements

- WordPress with REST API support enabled.
- A JazzHR account and API key.
- A page with the slug `job-board`.

## Installation

1. Copy the `jazzhr-jobs` directory into:

   `wp-content/plugins/`

2. Add the JazzHR API key to `wp-config.php`, above the line that says `That's all, stop editing!`:

   ```php
   define( 'JAZZHR_API_KEY', 'your-jazzhr-api-key' );
   ```

3. Activate **JazzHR Jobs Integration** from the WordPress Plugins screen.

4. Create a page with the slug:

   `job-board`

5. Add the following Custom HTML block to that page:

   ```html
   <div id="jazzhr-jobs">
       <div id="jazzhr-state-filters"></div>

       <div id="jazzhr-loading">Loading jobs...</div>
       <div id="jazzhr-error" hidden>Unable to load jobs.</div>
       <div id="jazzhr-no-results" hidden>No jobs found.</div>

       <div id="jazzhr-grid"></div>
       <div id="jazzhr-pagination"></div>
   </div>
   ```

The plugin loads its CSS and JavaScript automatically on the page whose slug is `job-board`.

## REST endpoint

Jobs are available at:

```text
/wp-json/jazzhr/v1/jobs
```

Example response:

```json
{
  "success": true,
  "count": 1,
  "jobs": [
    {
      "id": "12345",
      "title": "Security Guard",
      "location": "Denver, CO",
      "city": "Denver",
      "state": "CO",
      "zip": "80202",
      "description": "",
      "board_code": "example",
      "job_url": "https://example.applytojob.com/apply/example/security-guard"
    }
  ]
}
```

The endpoint is intentionally public because the job board is intended for public website visitors.

## API behavior

- JazzHR endpoint: `https://api.resumatorapi.com/v1/jobs/status/open`
- Successful responses are cached for 15 minutes.
- A short refresh lock prevents concurrent cold-cache requests from unnecessarily multiplying upstream requests.
- Upstream error details are not returned to frontend visitors.

## Troubleshooting

### Jobs show an HTTP 500 error

Check that `JAZZHR_API_KEY` is defined in `wp-config.php` and contains a value.

### Jobs show an HTTP 502 error

Check that the JazzHR API key is valid and has not been revoked. Also verify that the server can make outbound HTTPS requests to `api.resumatorapi.com`.

### The page is blank

Confirm that:

- The page slug is exactly `job-board`.
- The required HTML IDs are present.
- The plugin is activated.
- The browser console and `/wp-json/jazzhr/v1/jobs` endpoint do not report errors.

## Security notes

- Keep the JazzHR API key in `wp-config.php`, not in this plugin directory or frontend JavaScript.
- Do not commit real API keys to GitHub.
- Rotate the API key if it is exposed.

## License

This plugin is provided for use with the associated WordPress website. Add a project-specific license before publishing it as an open-source package.
