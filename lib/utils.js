module.exports = {
	fetchPath: async (path) => {
		try {
			return await require("fs").promises.lstat(path);
		}
		catch {
			return null;
		}
	}
}