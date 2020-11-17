module.exports = (function () {
	const fs = require("fs").promises;
	const xmlParser = require("xml-js");

	const { zones } = require("./zone-map.json");
	const { fetchPath } = require("./utils.js");

	return class SaveFileEditor {
		#path;
		#xml = null;
		#edited = false;

		constructor (path) {
			this.#path = path;
		}

		async load () {
			const exists = fetchPath(this.#path);
			if (!exists) {
				throw new Error("Provided save file does not exist");
			}

			const buffer = await fs.readFile(this.#path);
			this.#xml = xmlParser.xml2js(buffer.toString());
		}

		async save () {
			if (!this.#xml) {
				throw new Error("Save file content not loaded");
			}

			const content = xmlParser.js2xml(this.#xml).replace(`<?xml version="1.0"?>`, "<?xml?>");
			await fs.writeFile(this.#path, content);
		}

		async backup () {
			const now = Date.now();
			await fs.copyFile(this.#path, `${this.#path}-backup-${now}`);
		}

		editCustomSongPath (zone, path) {
			if (!this.#xml) {
				throw new Error("Save file content not loaded");
			}

			const input = zone.toLowerCase();
			const zoneDescriptor = SaveFileEditor.getZoneInfo(input);
			if (!zoneDescriptor) {
				throw new TypeError("Invalid zone identifier provided");
			}

			const gameData = this.#xml.elements[0].elements.find(i => i.name === "game");
			const newValue = (path === null) ? "|2350|DEFAULT|" : path;
			const attribute = "customSong" + zoneDescriptor.gameIndex;

			this.#edited = (gameData.attributes[attribute] !== newValue);

			gameData.attributes[attribute] = newValue;
		}

		get edited () { return this.#edited; }

		static getZones () {
			return zones;
		}

		static getZoneInfo (zone) {
			return zones.find(i => i.names.includes(zone));
		}
	};
})();