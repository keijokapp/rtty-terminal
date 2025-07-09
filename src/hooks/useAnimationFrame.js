import { useEffect } from 'react';

/**
 * @param {() => void} callback
 */
export default function useAnimationFrame(callback) {
	useEffect(() => {
		let mounted = true;
		let timeout;

		function draw() {
			if (mounted) {
				callback();

				timeout = setTimeout(() => requestAnimationFrame(draw, 100));
			}
		}

		draw();

		return () => {
			mounted = false;

			clearTimeout(timeout);
		};
	}, [callback]);
}
