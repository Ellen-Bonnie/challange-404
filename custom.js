
function toggleActive() {

$('#mobile-menu').on('click touchend', function( event ) {
  event.preventDefault();
  $('.dl-menuwrapper').toggleClass('active');
});
}

