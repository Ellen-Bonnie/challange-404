<script type="text/javascript">
$(function() {
  $("#mobile-menu").click(function() {
    // cssで背景色を切り替え
    //toggleClassメソッドは 指定したクラス名の CSS がある場合は削除を行い、なければ追加する というメソッド
    $("#mobile-menu").toggleClass("open");
  });
});
</script>
