
const submodule = require('./submodule')

export const render = async () => {
	return `<html>
		<head></head>
		<body>
			common js
			${submodule.text}
		</body>
	</html>`
}