
export const render = async () => {

	const submodule = await import('./submodule.js')

	return `<html>
		<head></head>
		<body>
			dynamic import
			${submodule.text}
		</body>
	</html>`
}