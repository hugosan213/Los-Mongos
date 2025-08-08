const items = document.querySelectorAll('.faq-item');

items.forEach(item => {
  const question = item.querySelector('.faq-question');
  question.addEventListener('click', () => {
    if (item.classList.contains('active')) {
      item.classList.remove('active');
    } else {
      items.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    }
  });
});
