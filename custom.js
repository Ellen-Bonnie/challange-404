
(function() {
  $("a#sidr").click(function() {
    // cssで背景色を切り替え
    //toggleClassメソッドは 指定したクラス名の CSS がある場合は削除を行い、なければ追加する というメソッド
    $("#mobile-menu").toggleClass("open");
  });
});
(function() {
  $("#bgBtn").click(function() {
    // cssで背景色を切り替え
    //toggleClassメソッドは 指定したクラス名の CSS がある場合は削除を行い、なければ追加する というメソッド
    $(".bgBox").toggleClass("bgPink");
	console.log("lalala");
  });
});