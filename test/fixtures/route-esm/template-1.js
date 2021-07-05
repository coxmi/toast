
import shared from './shared.js'

export const render = async () => {
	return `<html>
		<head></head>
		<body>
			esm
			template 1
			${ shared.text }
		</body>
	</html>`
}