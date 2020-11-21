module.exports = (function () {
	const path = require("path");
	const ytdl = require("youtube-dl");
	const { promisify } = require("util");
	const { fetchPath } = require("./utils.js");

	const getMediaInfo = (link) => promisify(ytdl.getInfo)(link);

	const downloadMedia = async (link, options = {}) => {
		let basePath;
		const info = await getMediaInfo(link);
		if (!options.filePath) {
			basePath = path.resolve(__dirname, "../music", info.id);
		}
		else {
			basePath = filePath.replace(/\.mp3$/, "");
		}

		const exists = await fetchPath(basePath + ".mp3");
		if (!exists || options.force === true) {
			const result = await promisify(ytdl.exec)(link, [
				"--extract-audio",
				"--format",
				"bestaudio",
				"--restrict-filenames",
				"--audio-format",
				"mp3",
				"--output",
				basePath + ".%(ext)s"
			], {});

			return {
				result,
				info,
				filePath: basePath + ".mp3",
				skipped: false
			};
		}
		else {
			return {
				result: null,
				info,
				filePath: basePath + ".mp3",
				skipped: true
			}
		}
	}

	return {
		downloadMedia,
		getMediaInfo
	};
})();