var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'MangaPark',
  website: 'https://mangapark.me',

  match: function(link, options) {
    return /mangapark\.me\/manga\//g.test(link) || /mangapark\.com\/manga\//g.test(link)
      || /mangapark\.net\/manga\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'MangaPark');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    if (page.url.indexOf('/c') > 0 
      &&  $('#viewer').length) {

      var chapter_title = $('.path .loc').first().text().trim();
      chapter_title = utils.replaceAll(chapter_title, ':', ' -');

      // Get images on current page
      var chapter_images = [];
      $('#viewer img.img').each(function() {
        var image_src = $(this).attr('src');
        if (image_src) {
          if (image_src.indexOf('//') == 0) image_src = 'http:' + image_src;
          chapter_images.push({
            src: image_src,
            file: path.basename(image_src)
          });
        }
      });
      if (options.verbose) console.log(chapter_images);

      var chapter_output_dir = '';
      chapter_output_dir = path.basename(page.output_dir);
      chapter_output_dir = path.join(options.output_dir, chapter_output_dir);
      
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

    } else if (page.url.indexOf('/manga/') > 0 
      && $('#list').length && $('.chapter').length) {
      console.log('Chapter list');

      if (options.auto_manga_dir) {
        var manga_title = $('.content .hd h1 a').first().text().trim();
        manga_title = utils.replaceAll(manga_title, ':', ' -');
        manga_title = utils.replaceAll(manga_title, '.', '_');
        console.log('Manga title: ' + manga_title);
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);

      $('#stream_1 .volume.collapsed').remove();

      var chapter_links = saver.getLinks($, page, '#stream_1 ul.chapter li', {
        blacklist: ['/1','/3-1','/6-1','/10-1'],
        filters: ['/manga/']
      });

      console.log('Chapters: ' + chapter_links.length);

      chapter_links = chapter_links.filter(function(chapter_link) {
        return !saver.isDone(chapter_link);
      });
      console.log('New Chapters:', chapter_links.length);

      // if ($('.pagination').length && $('.pagination li.next a').length) {
      //   var next_link = $('.pagination li.next a').attr('href');
      //   if (next_link && next_link != '') chapter_links.push(next_link);
      // }
      if (options.verbose) console.log(chapter_links);

      saver.processPages(chapter_links, options, callback);
    } else {
      callback();
    }
  }
}