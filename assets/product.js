const tabContent = document.querySelector('.content_tab_block');
const tabHeading = document.querySelectorAll('.content_tab_heading');
const tabContainer = document.querySelectorAll('.tab_container');

    if ( tabContent != null) {


tabContent.addEventListener("click",function(e){
  const clicked = e.target.closest(".content_tab_heading");

if(!clicked) return;

tabHeading.forEach(h=>h.classList.remove('content_tab--active'));
tabContainer.forEach(c=>c.classList.remove('tab_container--active'));

clicked.classList.add('content_tab--active');

document.querySelector(`.tab_container--${clicked.dataset.tab}`).classList.add('tab_container--active');
  
});

    }