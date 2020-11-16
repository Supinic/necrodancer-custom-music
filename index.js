#!/usr/bin/env node
(async function () {
	const fs = require("fs").promises;
	const util = require("util");
	const path = require("path");
	const ytdl = require("youtube-dl");
	const XML = require("xml-js");
	const shell = util.promisify(require("child_process").exec);

	const debugLog = (...args) => {
		if (arguments.debug) {
			console.log(...args);
		}
	};
	const fetchPath = async (path) => {
		try {
			return await fs.stat(path);
		}
		catch {
			return null;
		}
	};
	const abort = (...args) => {
		console.error(...args);
		process.exit(1);
	};

	const arguments = {};
	for (let i = 2; i < process.argv.length; i++) {
		const arg = process.argv[i];

		if (arg === "-h" || arg === "--help") {
			console.log(`Usage: index.js (video-link) (game-zone) [--bpm=#] [--offset=#] [--beattracker=path] [--force-reload]`);
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
			arguments.beattracker = arg.split("=")[1];
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
			const { zones } = require(__dirname + "/zone-map.json");
			const input = arg.toLowerCase();

			const zoneDescriptor = zones.find(i => i.names.includes(input));
			if (!zoneDescriptor) {
				abort("Invalid zone identifier provided - check zone-map.json for a list");
			}

			arguments.zone = zoneDescriptor;
		}
		else {
			console.log(`Usage: index.js (video-link) (game-zone) [--bpm=#] [--offset=#]`);
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
		debugLog("Loading config.json");
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

	if (!config.saveFile) {
		debugLog("No save file found, trying to detect");

		const saveRegex = /^save_data\d+\.xml$/;
		const dataPath = path.join(config.directory, "data");
		const files = await fs.readdir(dataPath);

		let file = files.find(i => saveRegex.test(i));
		if (!file) {
			abort("config.json - no save file could be auto-detected - manual config required");
		}
		else {
			debugLog(`Auto-detected save file "${file}"`);
			config.saveFile = file;
		}

		debugLog("Updating config.json - save file");
		await fs.writeFile(__dirname + "/config.json", JSON.stringify(config, null, 4));
	}

	debugLog("Fetching video info");
	const videoInfo = await util.promisify(ytdl.getInfo)(arguments.videoLink);

	debugLog("Checking for video file");
	const videoPath = path.resolve(__dirname, "music", videoInfo.id + ".mp3");
	const videoExists = await fetchPath(videoPath);
	if (!videoExists || arguments.force) {
		debugLog("Fetching video + creating audio file", videoPath);
		await util.promisify(ytdl.exec)(
			arguments.videoLink,
			[
				"--extract-audio",
				"--format", "bestaudio",
				"--restrict-filenames",
				"--audio-format", "mp3",
				"--output", path.resolve(__dirname, "music", videoInfo.id) + ".%(ext)s"
			],
			{}
		);
	}

	debugLog("Checking for beats file");
	const beatsPath = path.join(config.directory, "data", "custom_music", videoInfo.id + ".mp3.txt");
	const beatsExist = await fetchPath(beatsPath);
	if (!beatsExist || arguments.force) {
		if (arguments.bpm) {
			const beats = [];
			const offset = arguments.offset ?? 0;
			const interval = 60 / arguments.bpm;

			debugLog("Creating beats file from bpm argument");
			for (let i = 0; i < videoInfo._duration_raw; i += interval) {
				beats.push(i + offset);
			}

			await fs.writeFile(beatsPath, beats.join("\n"));
		}
		else {
			const beatTrackerPath = arguments.beattracker ?? path.join(config.directory, "data", "essentia", "beattracker.exe");
			const beatTrackerCheck = await fetchPath(beatTrackerPath);
			if (!beatTrackerCheck) {
				abort("Could not find beat-tracker");
			}

			debugLog("Detecting beats with beat-tracker", { beatsPath, beatTrackerPath, videoPath });
			await shell(`"${beatTrackerPath}" "${videoPath}" "${beatsPath}"`);
		}

		debugLog("Beats file created");
	}

	debugLog("Loading save file");
	const saveFilePath = path.join(config.directory, "data", config.saveFile);
	const saveFileContent = (await fs.readFile(saveFilePath)).toString().replace("<?xml?>", `<?xml version="1.0"?>`);
	const saveFileData = XML.xml2js(saveFileContent);

	// The game only accepts forward-slash delimited paths - even on Windows
	const forwardSlashVideoPath = videoPath.replace(/\\/g, "/");
	const gameData = saveFileData.elements[0].elements.find(i => i.name === "game");

	debugLog("Editing save file", { path: forwardSlashVideoPath, attribute: "customSong" + arguments.zone.gameIndex });
	gameData.attributes["customSong" + arguments.zone.gameIndex] = forwardSlashVideoPath;

	debugLog("Saving save file");
	const editedSaveFileContent = XML.js2xml(saveFileData).replace(`<?xml version="1.0"?>`, "<?xml?>");
	await fs.writeFile(saveFilePath, editedSaveFileContent);

	debugLog("All done!");
	process.exit(0);
})();