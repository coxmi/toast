
import shared from './shared.js'

export const url = '/template-1/'

export const html = () => {
	return `<html>
		<head></head>
		<body>
			<h1>esm</h1>
			<h2>template 1</h2>
			<p>${ shared.text }</p>
		</body>
	</html>`
}