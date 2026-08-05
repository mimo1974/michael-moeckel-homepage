export function findStaleImages(existingFiles: string[], currentImagePaths: (string | null)[]): string[] {
	const currentFilenames = new Set(
		currentImagePaths.filter((image): image is string => image != null).map((image) => image.split('/').pop()),
	);
	return existingFiles.filter((file) => !currentFilenames.has(file));
}
