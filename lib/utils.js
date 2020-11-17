module.exports = {
	fetchPath: async (path) => {
		try {
			return await require("fs").promises.stat(path);
		}
		catch {
			return null;
		}
	}
}