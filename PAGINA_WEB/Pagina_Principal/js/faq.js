document.addEventListener("DOMContentLoaded", function () {
  const faqItems = document.querySelectorAll(".faq-item");

  faqItems.forEach((item) => {
    const question = item.querySelector(".faq-question");
    const icon = item.querySelector(".faq-icon");

    question.addEventListener("click", function () {
      const isActive = item.classList.contains("active");

      // Cierra todos (comportamiento acordeón)
      faqItems.forEach((el) => {
        el.classList.remove("active");
        const elIcon = el.querySelector(".faq-icon");
        if (elIcon) elIcon.textContent = "+";
      });

      // Si no estaba activo, lo abrimos
      if (!isActive) {
        item.classList.add("active");
        if (icon) icon.textContent = "–";
      }
    });
  });
});
