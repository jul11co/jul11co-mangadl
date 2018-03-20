var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'MerakiScans',
  website: 'http://merakiscans.com',

  match: function(link, options) {
    return /merakiscans\.com\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'MerakiScans');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    if ($('#singleWrap').length && $('#singleWrap').length) {

      $('.wpm_pag.mng_rdr h1.ttl a').first().remove();
      var chapter_title = $('.wpm_pag.mng_rdr h1.ttl').first().text().trim();
      if (chapter_title) {
        chapter_title = chapter_title.replace('- ', '');
        chapter_title = utils.replaceAll(chapter_title, ':', ' -');
      }

      // console.log('Chapter title:', chapter_title);

      var chapter_images = saver.getImages($, page, '#longWrap');
      if (chapter_images.length == 0) return callback();

      if (options.verbose) console.log(chapter_images);

      var chapter_output_dir = '';
      if (chapter_title) {
        chapter_output_dir = path.join(options.output_dir, chapter_title);
      } else {
        chapter_output_dir = path.join(options.output_dir, path.basename(page.output_dir));
      }
      
      // console.log('Output dir: ', options.output_dir);
      // console.log('Page output_dir:', page.output_dir);
      // console.log('Chapter output_dir:', chapter_output_dir);

      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: chapter_output_dir
      }, options, function(err) {
        if (err) return callback(err);
        callback();
      });

    } else if ($('.mng_det').length && $('.lst.mng_chp').length) {
      console.log('Chapter list');

      if (options.auto_manga_dir && page.url.indexOf('/chapter-list/') == -1) {
        var manga_title = page.title.trim();
        manga_title = manga_title.replace(' - Manga Detail Meraki Scans','').trim();
        manga_title = utils.replaceAll(manga_title, ':', ' -');
        console.log('Manga title: ' + manga_title);
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);

      var chapter_links = saver.getLinks($, page, '.lst.mng_chp li');

      console.log('Chapters: ' + chapter_links.length);

      chapter_links = chapter_links.filter(function(chapter_link) {
        return !saver.isDone(chapter_link);
      });
      console.log('New Chapters:', chapter_links.length);
      if (options.verbose) console.log(chapter_links);

      if ($('ul.pgg').length && $('ul.pgg li a').length) {
        var chapter_list_pages = [];
        $('ul.pgg li a').each(function() {
          var chapter_list_page = $(this).attr('href');
          if (chapter_list_page && chapter_list_page != '#' 
            && chapter_list_pages.indexOf(chapter_list_page) == -1
            && !saver.isVisited(chapter_list_page)) {
            chapter_list_pages.push(chapter_list_page);
            chapter_links.push(chapter_list_page);
          }
        });
      }

      saver.processPages(chapter_links, options, callback);
    } else {
      callback();
    }
  }
}