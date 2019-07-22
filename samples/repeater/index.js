module.exports =
	(numbers /* Readable */, letters /* Readable */, squares /* Writable */, repeated_letters /* Writable */) => {
		numbers.on('data', (number) => {
			console.log(`Input #0 received: ${number}`);
			squares.write(number * number);
		});
		letters.on('data', (letter) => {
			console.log(`Input #1 received: ${letter}`);
			repeated_letters.write(`${letter}${letter}`);
		});
	};
