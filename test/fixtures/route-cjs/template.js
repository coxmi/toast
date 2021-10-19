
// cjs require needs .default
const submodule = require('./submodule').default

const url = '/'

const html = () => {
	return `<html>
		<head></head>
		<body>
			common js
			${submodule.text}
		</body>
	</html>`
}

module.exports = {
	url,
	html
}