import path from 'path';
import url from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';

const directoryName = path.dirname(url.fileURLToPath(import.meta.url));

export default {
	entry: path.join(directoryName, 'src', 'app.js'),
	output: {
		publicPath: '/'
	},
	plugins: [
		new HtmlWebpackPlugin({
			template: path.join(directoryName, 'src', 'index.html'),
			inject: 'body',
			scriptLoading: 'blocking',
			minify: false
		})
	]
};
