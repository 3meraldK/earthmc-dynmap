function addChunksLayer(data) {
	const chunkLines = []
	for (let x = -33280; x <= 33088; x += 16) {
		chunkLines.push([
			{ x: x, z: -16640 },
			{ x: x, z: +16512 },
			{ x: x, z: -16640 }
		])
	}
	for (let z = -16640; z <= 16512; z += 16) {
		chunkLines.push([
			{ x: -33280, z: z },
			{ x: +33088, z: z },
			{ x: -33280, z: z }
		])
	}

	data.push({
		hide: true,
		name: 'Chunks',
		control: true,
		id: 'chunks',
		markers: [{
			weight: 0.33,
			color: '#000000',
			type: 'polyline',
			points: chunkLines
		}]
	})
	return data
}