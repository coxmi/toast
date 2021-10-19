
export const collection = [
	{ url : 'hello-world' },
	{ url : 'how-i-only-used-1-million-dependencies-to-build-my-new-blog' },
	{ url : 'who-needs-reactjs-anyway' },
	{ url : 'framework-fatigue-in-2041' },
	{ url : 'ai-generated-webpack-config' },
	{ url : 'the-singularity-came-from-css-houdini' }
]

// split posts into chunks of five per page
export const perPage = 5 

// `/posts` for page 1, and `/posts/2…` for others
export const url = (content, { currentPage }) => {
	return (currentPage === 1)
    	? `/posts/`
        : `/posts/${currentPage}/`
}

// lists all items per page
export const html = (content, { currentPage, lastPage }) => 
	`<!DOCTYPE html>
	<html>
		<body>
			<h1>Page ${currentPage} of ${lastPage}</h1>
			<ul>
				${ content.map(post => 
					`<li><a href="${post.url}">${post.url}</a></li>`
				).join('') }
			</ul>
		</body>
	</html>`