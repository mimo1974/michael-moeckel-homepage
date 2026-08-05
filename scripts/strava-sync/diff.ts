export function hasNewActivities(previous: { id: number }[], latest: { id: number }[]): boolean {
	const previousIds = new Set(previous.map((activity) => activity.id));
	return latest.some((activity) => !previousIds.has(activity.id));
}
