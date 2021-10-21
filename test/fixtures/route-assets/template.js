
import imagePath from './test.jpg'

export const url = content => content.permalink

export const collection = [
	{ title : 'Home', permalink : '/' },
	{ title : 'Top level', permalink : '/top-level.html' },
	{ title : 'Sub page index', permalink : '/sub/' },
	{ title : 'Sub page', permalink : '/sub/sub.html' },
]

export const html = (content, meta) => {
	return `<html>
		<head></head>
		<body>
			<h1>${ content.title }</h1>
			<h2>variables</h2>
			<pre>meta.url: ${ meta.url }</pre>
			<pre>meta.output: ${ meta.output }</pre>
			<pre>meta.root: ${ meta.root }</pre>
			<pre>imagePath: ${ imagePath }</pre>
			<pre>meta.relative(imagePath): ${ meta.relative(imagePath) }</pre>
			<img src="${ meta.root + imagePath }">
		</body>
	</html>`
}