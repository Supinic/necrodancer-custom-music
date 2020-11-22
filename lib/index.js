module.exports = (function () {
	const path = require("path");
	const fs = require("fs").promises;

	const SaveFileEditor = require("./savefile.js");
	const { downloadMedia, getMediaInfo } = require("./download.js");
	const { beatmap } = require("./beatmap.js");
	const { fetchPath } = require("./utils.js");

	const saveRegex = /^save_data\d+\.xml$/;

	const getZoneName = (zoneData) => zoneData.names[0];
	const getSongFileName = (zoneData) => "song_" + getZoneName(zoneData) + ".mp3";

	/**
	 * In the given game directory, attempts to find a proper save file.
	 * Returns null if nothing fitting is found.
	 * @param {string} gameDir full path to game directory
	 * @returns {Promise<string|null>}
	 */
	const detectSaveFile = async (gameDir) => {
		const dataPath = path.join(gameDir, "data");
		const files = await fs.readdir(dataPath);

		const saveFile = files.find(i => saveRegex.test(i)) ?? null;
		if (saveFile === null) {
			return null;
		}

		return path.resolve(gameDir, "data", saveFile);
	};

	/**
	 * Edits the game save file, so that all zones' music will point to symlinks.
	 * This is so no more editing of the save files is necessary later.
	 * @param {string} saveFilePath full save file path
	 * @returns {Promise<void>}
	 */
	const prepareZoneSymlinks = async (saveFilePath) => {
		const zones = SaveFileEditor.getZones();
		const editor = new SaveFileEditor(saveFilePath);
		await editor.load();

		for (const zone of zones) {
			const filePath = path.resolve(__dirname, "../symlinks/", getSongFileName(zone));
			editor.editCustomSongPath(getZoneName(zone), filePath);
		}

		if (editor.edited) {
			await editor.save();
		}
	};

	/**
	 * Resets one or more zone music to "none" - the default null value in game
	 * @param {string} saveFilePath full save file path
	 * @param {string[]} zones list of zones to reset. if the first value is "all", resets all zones
	 * @returns {Promise<void>}
	 */
	const resetZones = async (saveFilePath, ...zones) => {
		if (zones[0] === "all") {
			zones = SaveFileEditor.getZones();
		}
		else {
			zones = zones.map(i => SaveFileEditor.getZoneInfo(i)).filter(Boolean);
		}

		const editor = new SaveFileEditor(saveFilePath);
		await editor.load();

		for (const zone of zones) {
			editor.editCustomSongPath(getZoneName(zone), null);
		}

		await editor.save();
	}

	/**
	 * Processes the provided link - downloads + beatmaps + saves it into the game save file into a given zone
	 * @param {Object} options
	 * @param {string} options.gameDir Game directory path.
	 * @param {string} options.link Media link path - needs to be compatible with youtube-dl.
	 * @param {string} options.zone Game zone identifier.
	 * @param {boolean} [options.backupSaveFile] If true explicitly, will create backups of save file.
	 * @param {boolean} [options.prepareAllSymlinks] If false explicitly, will not attempt to create symlinks for music in all zones.
	 * @param {string} [options.saveFile] Optional full path to game's save file. If not provided, one is detected automatically.
	 * @param {boolean} [options.forceDownload] If true, the audio file will be re-downloaded even if it is present already
	 * @param {boolean} [options.forceBeatmap] If true, the audio file will be beatmapped even if the beatmap file is present already
	 * @param {number} [options.bpm] When not using auto bpm detection, this is the song's BPM measure
	 * @param {number} [options.offset] When not using auto bpm detection, this is the song's BPM shift forward in seconds
	 * @param {string} [options.beatmapExecutable] When not using auto bpm detection, this is the path to the auto-detect executable
	 * @returns {Promise<FullProcessResponse>}
	 */
	const fullProcess = async (options = {}) => {
		const { gameDir, link, zone } = options;
		if (!gameDir) {
			throw new Error("Game directory not provided");
		}
		else if (!link) {
			throw new Error("Music media link not provided");
		}
		else if (!zone) {
			throw new Error("Zone not provided");
		}

		const downloadInfo = await downloadMedia(link, {
			force: options.forceDownload
		});

		const beatmapInfo = await beatmap({
			fileName: downloadInfo.info.id + ".mp3",
			filePath: downloadInfo.filePath,
			duration: downloadInfo.info.duration,
			bpm: options.bpm,
			offset: options.offset,
			beatmapExecutable: options.beatmapExecutable ?? path.join(gameDir, "data", "essentia", "beattracker.exe")
		});

		const save = options.saveFile ?? await detectSaveFile(gameDir);
		if (options.prepareAllSymlinks !== false) {
			await prepareZoneSymlinks(save);
		}

		const zoneData = SaveFileEditor.getZoneInfo(zone);
		const symlinkBase = getSongFileName(zoneData);

		const musicSymlink = path.resolve(__dirname, "../symlinks/" + symlinkBase);
		if (await fetchPath(musicSymlink)) {
			await fs.unlink(musicSymlink);
		}

		await fs.symlink(downloadInfo.filePath, musicSymlink);

		const beatmapSymlink = path.resolve(gameDir, "data", "custom_music", symlinkBase + ".txt");
		if (await fetchPath(beatmapSymlink)) {
			await fs.unlink(beatmapSymlink);
		}

		await fs.symlink(beatmapInfo.filePath, beatmapSymlink);
		if (!save) {
			throw new Error("No save file detected/provided");
		}

		const editor = new SaveFileEditor(save);
		await editor.load();

		if (options.backupSaveFile === true) {
			await editor.backup();
		}

		editor.editCustomSongPath(zoneData.names[0], musicSymlink);
		await editor.save();

		return {
			beatmapFile: beatmapInfo.filePath,
			mediaFile: downloadInfo.filePath
		};
	}

	return {
		beatmap,
		detectSaveFile,
		downloadMedia,
		fullProcess,
		fetchPath,
		getMediaInfo,
		prepareZoneSymlinks,
		resetZones,
		SaveFileEditor
	};
})();

/**
 * @typedef {Object} FullProcessResponse
 * @property {string} beatmapFile
 * @property {string} mediaFile
 */