function toggleActive() {

$('#mobile-menu').on('click touchend', function( event ) {
  event.preventDefault();
  $('body').toggleClass('active');
});
}
