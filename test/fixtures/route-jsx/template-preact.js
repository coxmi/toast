
import { h } from 'preact'
import { default as html } from 'preact-render-to-string'

export const render = async () => {
	return `<html>
		<head></head>
		<body>
			${html(<div>template-preact</div>)}
		</body>
	</html>`
}