document.addEventListener('click', (e) => {
	if (e.target.nodeName == 'SPAN')
		e.target.classList.toggle('highlighted');
});
