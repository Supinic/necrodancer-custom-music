# necrodancer-custom-music
CLI tool used to import custom music into Crypt of the Necrodancer without being in-game.

## Rundown
1) Downloads the provided media URL with `youtube-dl`
2) Converts the media to `MP3` format with `ffmpeg` or any other valid converter
3) Beat-maps the audio file with `beattracker` based on `essentia` (shipped with the game on Windows); alternatively, uses a static beats-per-minute value
4) Edits the game's save file to add dummy symlinks - all at once (only happens when run for the first time)
5) Creates a symlink for the music file in `./symlinks` <==> `./music`
6) Creates a symlink for the beatmap file in `./beatmaps` <==> `(game-dir)/data/custom_music/` 

Remarks:
- Audio files are stored in `./music/` 
- Beatmap files are stored in `./beatmaps`
- Since the script is using symlinks, the music can be swapped:
    - when the game is not running
    - ingame, in lobby
    - ingame, in a different level
- On Windows, in order to create symlinks, admin rights are required. 
Alternatively, the `SeCreateSymbolicLinkPrivilege` privilege needs to be allowed for the current user.
More info: [StackExchange discussion](https://security.stackexchange.com/questions/10194/why-do-you-have-to-be-an-admin-to-create-a-symlink-in-windows)


## Module

Exported members: 
```js
const {
    beatmap,
    detectSaveFile,
    downloadMedia,
    fullProcess,
    fetchPath,
    getMediaInfo,
    prepareZoneSymlinks,
    removeZoneSymlinks,
    resetZones,
    SaveFileEditor
} = require("necrodancer-custom-music");
```

#### `fullProcess {AsyncFunction}`
Fully processes the provided link - downloads + beatmaps + saves it into the game save file into a given zone.
	
Arguments:
 - `{string} options.gameDir` Game directory path.
 - `{string} options.link` Media link path - needs to be compatible with youtube-dl.
 - `{string} options.zone` Game zone identifier.
 - `boolean} [options.backupSaveFile]` If true explicitly, will create backups of save file.
 - `{boolean} [options.prepareAllSymlinks]` If false explicitly, will not attempt to create symlinks for music in all zones.
 - `{string} [options.saveFile]` Optional full path to game's save file. If not provided, one is detected automatically.
 - `{boolean} [options.forceDownload]` If true, the audio file will be re-downloaded even if it is present already
 - `{boolean} [options.forceBeatmap] `If true, the audio file will be beatmapped even if the beatmap file is present already
 - `{number} [options.bpm]` When not using auto bpm detection, this is the song's BPM measure
 - `{number} [options.offset]` When not using auto bpm detection, this is the song's BPM shift forward in seconds
 - `{string} [options.beatmapExecutable]` When not using auto bpm detection, this is the path to the auto-detect executable

Returns:
- nothing

#### `beatmap` `{AsyncFunction}`
Creates a beatmap file for a provided audio file and path. 

Arguments: 
- `{Object} options`
- `{string} [options.beatmapExecutable]` Path to the beatmapping executable
- `{string} options.fileName` Audio file name
- `{string} options.filePath` Path to the audio file to beatmap
- `{number} [options.bpm]` Static BPM - used when no executable is provided
- `{number} [options.offset]` Static BPM - offset - shift forward, in seconds

Returns:
- `{Object} result`
- `{string} result.filePath` Resulting beatmap file name 
- `{"auto"|"manual"} result.beats` Confirmation of what BPM mapping method was used

#### `detectSaveFile` `{Function}`
Detects a save file within the game's install directory.

Arguments: 
- `{string} gameDir` Game install directory 

Returns:
- `{string|null} path` Full savefile path, or `null`, if none were found

#### `downloadMedia` `{AsyncFunction}`
Downloads the audio file based on a URL, using `youtube-dl`.

Arguments: 
- `{string} link` Media file URL
- `{Object} options` 
- `{string} [options.filePath]` If provided, this is the path the resulting audio file will be saved to. Determined automatically if not present. 
- `{boolean} [options.force]` If true, the audio will be re-downloaded even if it exists already. 

Returns: 
- `{*} result` youtube-dl download result
- `{*} info` youtube-dl get-video-info result
- `{string|null} filePath` Result audio file path
- `{boolean} skipped` Determines if the download was skipped

#### `fetchPath {AsyncFunction}`
Small utils method for non-throwing check if a file/directory exists.

Arguments: 
- `{string} path`

Returns: 
- `{*|null}` result of `fs.stat` if file exists; if it doesn't, `null` instead

#### `getMediaInfo {AsyncFunction}`
Simple async wrapper for `youtube-dl.getInfo`.

Arguments: 
- `{string} link` media URL

Returns: 
- `{Object} result` return value of `youtube-dl.getInfo`

#### `prepareZoneSymlinks {AsyncFunction}`
Edits the game save file, so that all zones' music will point to symlinks.
This is so no more editing of the save files is necessary later.

Arguments 
- `{string} saveFilePath` full save file path

Returns
- nothing

#### `removeZoneSymlinks {AsyncFunction}`
Removes symlinks for each provided zone.

Arguments 
- `{...string} ...zones` Zones to as a list of arguments

Returns
- nothing

#### `resetZones {AsyncFunction}`
Resets one or more zone music to "none" - the default null value in game
	 * @param 
	 * @param 

Arguments 
- `{string} saveFilePath` full save file path
- `{string[]} zones` list of zones to reset. if the first value is "all", resets all zones

Returns
- nothing

#### `SaveFileEditor {class}`
Works with a single save file, and edits some of its attributes. Acts as a wrapper around the save file's XML structure.

## CLI tool

### Usage
- clone/fork the repo
- run `npm` or `yarn`
- run `npm run init` or `yarn run init`
- edit `config.json` and fill in the `directory` property with your Crypt of the Necrodancer install directory
- make sure to back up your game save file before proceeding - in case it needs to be rolled back
- run script with `node ./crypt.js` or `./crypt.js` (with shebang)

### Config
- `directory` - path to Crypt of the NecroDancer install directory
- `beatmapExecutable` - path to the beat-mapping executable (note that relevant argument has higher priority than config value)

### Arguments
```./crypt.js (video-url) (zone-id) [-h|--help] [--bpm] [--offset] [--force-reload] [--beat-tracker]```

- `-h`, `--help` Prints a simple usage help
- `(video-url)` First argument - media video link to be downloaded, beat-mapped and added to the game
- `(zone-id)` Second argument - game zone identifier
- `--bpm=#` If provided, the beat will be static, and generated from the provided BPM number
- `--offset=#` If provided along with `--bpm`, the beats will be shifted forward by this offset - provided in **seconds**
- `--force-reload` Re-downloads the audio file, and re-runs beat mapping even if the files are already present
- `--beat-tracker` When using automatic beat mapping, this is the path to the beat-mapping executable.
If not provided, uses the default one found on Windows in `(game-dir)/data/essentia/beattracker.exe` 
- `--debug` Enables debug logging

## Zone identifiers
Each song can be bound to exactly one game zone track per execution.
The full list of identifiers can be found in `./zone-map.json`, and edited - if this is desired

### Regular zones
These follow the identifier format `(zone)-(level)`, ranging from `1-1` through `5-3`.

### Boss zones
Boss areas can use either of multiple identifiers:

| Boss  |Full | Simple | Code  |
| :---- |:---:|  :---: | :---: |
| King Conga Kappa | `king-conga`   | `conga` | `boss-1` |
| Deep Blues       | `deep-blues`   | `chess` | `boss-2` |
| Death Metal      | `death-metal`  | `metal` | `boss-3` |
| Coral Riff       | `coral-riff`   | `coral` | `boss-4` |
| Fortissimole     | `fortissimole` | `mole`  | `boss-5` |