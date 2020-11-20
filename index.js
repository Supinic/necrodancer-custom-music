#!/usr/bin/env node
(async function () {
	const { fetchPath } = require(__dirname + "/lib/utils.js");
	const { fullProcess } = require(__dirname + "/lib/index.js");
	const helpString = "Usage: index.js (video-link) (game-zone) [--bpm=#] [--offset=#] [--force-reload] [--beat-tracker=path]";

	const abort = (...args) => {
		console.error(...args);
		process.exit(1);
	};

	const arguments = {};
	for (let i = 2; i < process.argv.length; i++) {
		const arg = process.argv[i];

		if (arg === "-h" || arg === "--help") {
			console.log(helpString);
			process.exit(0);
		}
		else if (arg.includes("--bpm=")) {
			arguments.bpm = Number(arg.split("=")[1]);
			if (Number.isNaN(arguments.bpm) || arguments.bpm <= 0 || arguments.bpm >= 60_000) {
				console.error("Invalid BPM provided - must be a number, between <0, 60000>");
				process.exit(1);
			}
		}
		else if (arg.includes("--offset=")) {
			arguments.offset = Number(arg.split("=")[1]);
			if (Number.isNaN(arguments.offset) || arguments.offset <= 0) {
				abort("Invalid offset provided - must be a positive number");
			}
		}
		else if (arg.includes("--beat-tracker=")) {
			arguments.beatmapExecutable = arg.split("=")[1];
		}
		else if (arg.includes("--debug")) {
			arguments.debug = true;
		}
		else if (arg.includes("--force-reload")) {
			arguments.force = true;
		}
		else if (i === 2) {
			arguments.videoLink = arg;
		}
		else if (i === 3) {
			arguments.zone = arg;
		}
		else {
			console.log(helpString);
			abort(`Invalid argument provided: "${arg}"`);
		}
	}

	if (!arguments.videoLink) {
		abort("No video link provided");
	}
	else if (!arguments.zone) {
		abort("No zone provided");
	}

	let config;
	try {
		config = require(__dirname + "/config.json");
	}
	catch (e) {
		die("config.json load error", e.message);
	}

	if (!config.directory) {
		abort("config.json - no dir path configured");
	}
	else {
		const dir = await fetchPath(config.directory);
		if (!dir) {
			abort("config.json - dir path does not exist");
		}
		else if (!dir.isDirectory()) {
			abort("config.json - dir path is not a directory");
		}
	}

	try {
		await fullProcess({
			gameDir: config.directory,
			link: arguments.videoLink,
			zone: arguments.zone,

			bpm: arguments.bpm,
			offset: arguments.offset,
			force: arguments.force,
			beatmapExecutable: arguments.beatmapExecutable ?? config.beatmapExecutable
		});
	}
	catch (e) {
		abort("Proces failed - " + e.message);
	}

	process.exit(0);
})();