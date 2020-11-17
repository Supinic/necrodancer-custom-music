module.exports = (function () {
	const path = require("path");
	const { promisify } = require("util");
	const shell = promisify(require("child_process").exec);
	const { fetchPath } = require("./utils.js");

	const beatmap = async (options = {}) => {
		const filePath = path.resolve(__dirname, "../beatmaps/" + options.fileName + ".txt");
		if (await fetchPath(filePath) && options.force !== true) {
			return {
				filePath,
				skipped: true
			};
		}

		if (options.beatmapExecutable) {
			const exec = options.beatmapExecutable;
			if (!await fetchPath(exec)) {
				throw new Error("beatmapping executable not found");
			}

			await shell(`"${exec}" "${options.filePath}" "${filePath}"`);
			
			return {
				filePath,
				beats: "auto"
			};	
		}
		else if (options.bpm) {
			if (typeof options.bpm !== "number") {
				throw new TypeError("BPM must be a number");
			}
			else if (typeof options.duration !== "number") {
				throw new TypeError("Audio duration must be a number");
			}

			const beats = [];
			const offset = options.offset ?? 0;
			const interval = 60 / options.bpm;
			for (let i = 0; i < options.duration; i += interval) {
				beats.push(i + offset);
			}

			await fs.writeFile(filePath, beats.join("\n"));

			return {
				filePath,
				beats: "manual"
			};
		}
		else {
			throw new Error("Cannot create beatmap - no executable and no bpm provided");
		}
	};
	
	return { beatmap };
})()