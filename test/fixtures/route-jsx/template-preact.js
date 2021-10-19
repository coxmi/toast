
import { h } from 'preact'
import render from 'preact-render-to-string'

export const url = '/'

export const html = () => {
	return `<html>
		<head></head>
		<body>
			${render(<h1>jsx-rendered</h1>)}
		</body>
	</html>`
}