document.addEventListener('DOMContentLoaded', function () {

	/*
	 * =====================================================
	 * CONFIGURATION
	 * =====================================================
	 */

	const API_URL = JazzHRJobs.apiUrl;

	const JOBS_PER_PAGE = 12;


	/*
	 * =====================================================
	 * ELEMENTS
	 * =====================================================
	 */

	const jobsGrid =
		document.getElementById('jazzhr-grid');

	const filtersContainer =
		document.getElementById('jazzhr-state-filters');

	const loadingMessage =
		document.getElementById('jazzhr-loading');

	const errorMessage =
		document.getElementById('jazzhr-error');

	const noResultsMessage =
		document.getElementById('jazzhr-no-results');

	const paginationContainer =
		document.getElementById('jazzhr-pagination');


	/*
	 * =====================================================
	 * DATA
	 * =====================================================
	 */

	let allJobs = [];

	let filteredJobs = [];

	let currentState = '';

	let currentPage = 1;


	/*
	 * =====================================================
	 * LOAD JOBS
	 * =====================================================
	 */

	async function loadJobs() {

		showLoading();

		try {

			const response = await fetch(API_URL, {
				method: 'GET',
				headers: {
					'Accept': 'application/json'
				},
				cache: 'no-cache'
			});


			if (!response.ok) {

				throw new Error(
					'HTTP error: ' + response.status
				);

			}


			const data = await response.json();


			if (
				!data ||
				data.success !== true ||
				!Array.isArray(data.jobs)
			) {

				throw new Error(
					'Invalid API response.'
				);

			}


			/*
			 * Store all jobs.
			 */

			allJobs = data.jobs;


			/*
			 * Sort jobs alphabetically by title.
			 */

			allJobs.sort(function (a, b) {

				return String(a.title || '')
					.localeCompare(
						String(b.title || '')
					);

			});


			hideLoading();


			/*
			 * Create filter buttons.
			 */

			createFilterButtons();


			/*
			 * Initially show all jobs.
			 */

			filterJobs('');


		} catch (error) {

			console.error(
				'JazzHR Jobs Error:',
				error
			);

			showError();

		}

	}


	/*
	 * =====================================================
	 * CREATE FILTER BUTTONS
	 * =====================================================
	 */

	function createFilterButtons() {

		if (!filtersContainer) {
			return;
		}


		filtersContainer.innerHTML = '';


		/*
		 * -----------------------------------------------
		 * ALL JOBS BUTTON
		 * -----------------------------------------------
		 */

		const allButton =
			createFilterButton(
				'',
				'See All Jobs'
			);


		allButton.classList.add(
			'is-active'
		);


		filtersContainer.appendChild(
			allButton
		);


		/*
		 * -----------------------------------------------
		 * GET UNIQUE STATES
		 * -----------------------------------------------
		 */

		const states = new Set();


		allJobs.forEach(function (job) {

			const state =
				getJobState(job);

			if (state) {

				states.add(
					state.trim()
				);

			}

		});


		/*
		 * Sort states alphabetically.
		 */

		const sortedStates =
			Array.from(states).sort(
				function (a, b) {

					return a.localeCompare(b);

				}
			);


		/*
		 * -----------------------------------------------
		 * CREATE STATE BUTTONS
		 * -----------------------------------------------
		 */

		sortedStates.forEach(function (state) {


		let buttonText = state + ' Jobs';

		if (state.toUpperCase() === 'AZ') {
			buttonText = 'Arizona Jobs';
		} else if (state.toUpperCase() === 'CO') {
			buttonText = 'Colorado Jobs';
		}

		const button =
			createFilterButton(
				state,
				buttonText
			);

		filtersContainer.appendChild(button);
	});

	}


	/*
	 * =====================================================
	 * CREATE FILTER BUTTON
	 * =====================================================
	 */

	function createFilterButton(
		state,
		text
	) {

		const button =
			document.createElement('button');


		button.type = 'button';


		button.className =
			'jazzhr-filter-button';


		button.textContent =
			text;


		button.dataset.state =
			state.toLowerCase();


		button.addEventListener(
			'click',
			function () {

				/*
				 * Remove active class.
				 */

				document
					.querySelectorAll(
						'.jazzhr-filter-button'
					)
					.forEach(
						function (item) {

							item.classList.remove(
								'is-active'
							);

						}
					);


				/*
				 * Activate clicked button.
				 */

				button.classList.add(
					'is-active'
				);


				/*
				 * Filter jobs.
				 */

				currentState =
					state.toLowerCase();


				currentPage = 1;


				filterJobs(
					currentState
				);

			}
		);


		return button;

	}


	/*
	 * =====================================================
	 * GET JOB STATE
	 * =====================================================
	 */

	function getJobState(job) {

		/*
		 * First use explicit state.
		 */

		if (
			job.state &&
			String(job.state).trim() !== ''
		) {

			return String(
				job.state
			).trim();

		}


		/*
		 * Otherwise get state from location.
		 */

		if (
			job.location &&
			String(job.location).trim() !== ''
		) {

			return extractState(
				String(job.location)
			);

		}


		return '';

	}


	/*
	 * =====================================================
	 * EXTRACT STATE
	 * =====================================================
	 */

	function extractState(location) {

		if (!location) {
			return '';
		}


		const parts =
			location
				.split(',')
				.map(function (part) {

					return part.trim();

				})
				.filter(Boolean);


		if (parts.length >= 2) {

			return parts[
				parts.length - 1
			];

		}


		return '';

	}


	/*
	 * =====================================================
	 * FILTER JOBS
	 * =====================================================
	 */

	function filterJobs(state) {

		const selectedState =
			String(state || '')
				.trim()
				.toLowerCase();


		if (!selectedState) {

			filteredJobs =
				[...allJobs];

		} else {

			filteredJobs =
				allJobs.filter(
					function (job) {

						const jobState =
							getJobState(job)
								.toLowerCase();


						return (
							jobState ===
							selectedState
						);

					}
				);

		}


		/*
		 * Reset page.
		 */

		currentPage = 1;


		/*
		 * Render.
		 */

		renderCurrentPage();

	}


	/*
	 * =====================================================
	 * RENDER CURRENT PAGE
	 * =====================================================
	 */

	function renderCurrentPage() {

		if (!jobsGrid) {
			return;
		}


		/*
		 * Clear grid.
		 */

		jobsGrid.innerHTML = '';


		/*
		 * No jobs.
		 */

		if (
			!filteredJobs ||
			filteredJobs.length === 0
		) {

			if (noResultsMessage) {

				noResultsMessage.hidden =
					false;

			}


			if (paginationContainer) {

				paginationContainer.innerHTML =
					'';

			}


			return;

		}


		/*
		 * Hide no-results.
		 */

		if (noResultsMessage) {

			noResultsMessage.hidden =
				true;

		}


		/*
		 * Calculate pagination.
		 */

		const startIndex =
			(currentPage - 1) *
			JOBS_PER_PAGE;


		const endIndex =
			startIndex +
			JOBS_PER_PAGE;


		const jobsForPage =
			filteredJobs.slice(
				startIndex,
				endIndex
			);


		/*
		 * Create cards.
		 */

		jobsForPage.forEach(
			function (job) {

				const card =
					createJobCard(job);

				jobsGrid.appendChild(
					card
				);

			}
		);


		/*
		 * Create pagination.
		 */

		renderPagination();

	}


	/*
	 * =====================================================
	 * CREATE JOB CARD
	 * =====================================================
	 */

	function createJobCard(job) {
	const card = document.createElement('article');
	card.className = 'jazzhr-card';

	const content = document.createElement('div');
	content.className = 'jazzhr-card-content';

	// Job title
	const title = document.createElement('h3');
	title.className = 'jazzhr-card-title';
	title.textContent = job.title || 'Untitled Job';

	content.appendChild(title);

	// Location wrapper
	const locationWrapper = document.createElement('div');
	locationWrapper.className = 'jazzhr-card-location-wrapper';

	// Location label
	const locationLabel = document.createElement('span');
	locationLabel.className = 'jazzhr-card-location-label';
	locationLabel.textContent = 'Location: ';

	// Location value
	const locationValue = document.createElement('span');
	locationValue.className = 'jazzhr-card-location';

	locationValue.textContent =
		job.location ||
		[job.city, job.state].filter(Boolean).join(', ') ||
		'Location not specified';

	locationWrapper.appendChild(locationLabel);
	locationWrapper.appendChild(locationValue);

	content.appendChild(locationWrapper);

	card.appendChild(content);

	// Footer
	const footer = document.createElement('div');
	footer.className = 'jazzhr-card-footer';

	/*
	 * View Details link
	 */
	if (job.job_url) {
		const detailsLink = document.createElement('a');

		detailsLink.className = 'jazzhr-view-details';
		detailsLink.href = job.job_url;
		detailsLink.target = '_blank';
		detailsLink.rel = 'noopener noreferrer';
		detailsLink.setAttribute(
			'aria-label',
			'View details for ' + (job.title || 'this job')
		);

		// Text
		const detailsText = document.createElement('span');
		detailsText.textContent = 'View Details';

		// Arrow
		const arrow = document.createElement('span');
		arrow.className = 'jazzhr-arrow';
		arrow.setAttribute('aria-hidden', 'true');
		arrow.innerHTML = '&rarr;';

		detailsLink.appendChild(detailsText);
		detailsLink.appendChild(arrow);

		footer.appendChild(detailsLink);
	}

	card.appendChild(footer);

	return card;
}


	/*
	 * =====================================================
	 * BUILD LOCATION
	 * =====================================================
	 */

	function buildLocation(job) {

		const parts = [];


		if (job.city) {
			parts.push(job.city);
		}


		if (job.state) {
			parts.push(job.state);
		}


		return parts.join(', ');

	}


	/*
	 * =====================================================
	 * PAGINATION
	 * =====================================================
	 */

	function renderPagination() {

		if (!paginationContainer) {
			return;
		}


		paginationContainer.innerHTML =
			'';


		const totalPages =
			Math.ceil(
				filteredJobs.length /
				JOBS_PER_PAGE
			);


		/*
		 * No pagination required.
		 */

		if (totalPages <= 1) {
			return;
		}


		/*
		 * Previous button.
		 */

		const previousButton =
			createPaginationButton(
				'Previous',
				currentPage - 1
			);


		previousButton.disabled =
			currentPage === 1;


		paginationContainer.appendChild(
			previousButton
		);


		/*
		 * Page numbers.
		 */

		for (
			let page = 1;
			page <= totalPages;
			page++
		) {

			const button =
				createPaginationButton(
					String(page),
					page
				);


			if (page === currentPage) {

				button.classList.add(
					'is-active'
				);

			}


			paginationContainer.appendChild(
				button
			);

		}


		/*
		 * Next button.
		 */

		const nextButton =
			createPaginationButton(
				'Next',
				currentPage + 1
			);


		nextButton.disabled =
			currentPage === totalPages;


		paginationContainer.appendChild(
			nextButton
		);

	}


	/*
	 * =====================================================
	 * PAGINATION BUTTON
	 * =====================================================
	 */

	function createPaginationButton(
		text,
		page
	) {

		const button =
			document.createElement('button');


		button.type = 'button';


		button.className =
			'jazzhr-pagination-button';


		button.textContent =
			text;


		button.addEventListener(
			'click',
			function () {

				if (
					page < 1 ||
					page >
					Math.ceil(
						filteredJobs.length /
						JOBS_PER_PAGE
					)
				) {

					return;

				}


				currentPage =
					page;


				renderCurrentPage();


				/*
				 * Scroll back to top of
				 * job grid.
				 */

				if (jobsGrid) {

					jobsGrid.scrollIntoView({
						behavior: 'smooth',
						block: 'start'
					});

				}

			}
		);


		return button;

	}


	/*
	 * =====================================================
	 * LOADING
	 * =====================================================
	 */

	function showLoading() {

		if (loadingMessage) {

			loadingMessage.hidden =
				false;

		}


		if (errorMessage) {

			errorMessage.hidden =
				true;

		}


		if (noResultsMessage) {

			noResultsMessage.hidden =
				true;

		}

	}


	function hideLoading() {

		if (loadingMessage) {

			loadingMessage.hidden =
				true;

		}

	}


	/*
	 * =====================================================
	 * ERROR
	 * =====================================================
	 */

	function showError() {

		if (loadingMessage) {

			loadingMessage.hidden =
				true;

		}


		if (errorMessage) {

			errorMessage.hidden =
				false;

		}


		if (noResultsMessage) {

			noResultsMessage.hidden =
				true;

		}

	}


	/*
	 * =====================================================
	 * START
	 * =====================================================
	 */

	loadJobs();

});