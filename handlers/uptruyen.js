var path = require('path');

module.exports = {
  
  name: 'Uptruyen',
  website: 'http://uptruyen.com',

  match: function(link, options) {
    return /uptruyen\.com\/manga\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'Uptruyen');
      saver.setMangaOutputDir(options.output_dir);
    }

    if ($('#reader-box').length) {

      var chapter_title = page.title.split('|')[0].trim();

      var chapter_images = saver.getImages($, page, '#reader-box', {
        blacklist: ['.gif']
      });
      if (options.debug) console.log(chapter_images);

      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: page.output_dir.replace('.html','')
      }, options, callback);

    } else if ($('.detail-page').length && $('#chapter_table').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('.breadcrumb a').last().text().trim();
      console.log('Manga title: ' + manga_title);
      console.log('Chapter list');

      if (options.auto_manga_dir) {
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }
      
      saver.setStateData('url', page.url);
      
      var chapter_links = saver.getLinks($, page, '#chapter_table', {
        exclude_visited_links: true
      });

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  }
}