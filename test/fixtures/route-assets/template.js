
import testImage from './test.jpg'

export const url = ({ permalink }) => permalink

export const collection = [
	{ title : 'Home', permalink : '/' },
	{ title : 'Sub page', permalink : '/sub/' },
]

export const html = (content, meta) => {
	return `<html>
		<head></head>
		<body>
			<h1>${ content.title }</h1>
			<img src="${ meta.relativeRoot + testImage }">
		</body>
	</html>`
}