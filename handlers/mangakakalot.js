var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

var lastChar = function(str) {
  if (!str) return '';
  if (str.length == 1) return str;
  return str.substring(str.length-1);
}

var removeLastChar = function(str) {
  return str.substring(0, str.length-1);
}

var removeLastChars = function(str, char_to_remove) {
  while(lastChar(str) == char_to_remove) {
    str = removeLastChar(str);
  }
  return str;
}

module.exports = {
  
  name: 'MangaKakalot',
  website: 'http://mangakakalot.com',

  match: function(link, options) {
    return (/mangakakalot\.com\/manga\//g.test(link) || /mangakakalot\.com\/chapter\//g.test(link)
      || /manganelo\.com\/manga\//g.test(link) || /manganelo\.com\/chapter\//g.test(link));
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'MangaKakalot');
      saver.setMangaOutputDir(options.output_dir);
    }

    if (page.url.indexOf('/chapter/') > 0 && $('#vungdoc').length) {

      var chapter_url = page.url;
      var chapter_title = $('.info-top-chapter h2').first().text().trim();
      chapter_title = utils.replaceAll(chapter_title, ':', ' -');
      chapter_title = utils.replaceAll(chapter_title, '.', '_');

      if (options.verbose)console.log('Chapter:', chapter_title);

      var chapter_images = saver.getImages($, page, '#vungdoc');
      if (options.verbose) console.log(chapter_images);

      var chapter_url_obj = urlutil.parse(chapter_url);
      var output_dir_name = path.basename(chapter_url_obj.pathname);
      // var output_dir_name = path.basename(path.dirname(chapter_url_obj.pathname));
      var chapter_output_dir = path.join((options.output_dir || '.'), output_dir_name);
      
      if (options.verbose) {
      console.log('Options output dir : ' + options.output_dir);
      console.log('Page output dir    : ' + page.output_dir);
      console.log('Chapter output dir : ' + chapter_output_dir);
      }

      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: chapter_output_dir,
        output_dir_name: output_dir_name
      }, options, function(err) {
        if (err) return callback(err);
        callback();
      });

    } else if (page.url.indexOf('/manga/') > 0 
      && $('#chapter').length && $('.chapter-list').length) {
      console.log('Chapter list');

      if (options.auto_manga_dir) {
        var manga_title = $('.manga-info-text h1').first().text().trim();
        manga_title = utils.replaceAll(manga_title, ':', ' -');
        manga_title = removeLastChars(manga_title, '.');
        console.log('Manga title: ' + manga_title);
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);
      
      var chapter_links = saver.getLinks($, page, '#chapter .chapter-list', {
        filters: [ '/chapter/' ]
      });

      console.log(chapter_links.length + ' chapters');
      if (options.verbose) console.log(chapter_links);

      chapter_links = chapter_links.filter(function(chapter_link) {
        return !saver.isDone(chapter_link);
      });
      console.log(chapter_links.length + ' new chapters');

      saver.processPages(chapter_links, options, callback);

    } else {
      callback();
    }
  }
}