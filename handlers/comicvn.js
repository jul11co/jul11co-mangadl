var path = require('path');
var urlutil = require('url');

function unescapeHtml(safe) {
  return safe.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

module.exports = {
  
  name: 'Comicvn',
  website: 'http://comicvn.net',

  match: function(link, options) {
    return /comicvn\.net/g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {
    
    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'Comicvn');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    if ($('.manga-chapter-image').length) {
      page.title = $('title').first().text();
      if (page.title) {
        page.title = page.title.replace(/(\r\n|\n|\r)/gm, '');
      }

      var chapter_url = page.url;
      var chapter_title = $('.manga-chapter-main .sub-bor').first().text().trim().replace('/','-');

      var images_list_html = $('#txtarea').html();

      images_list_html = unescapeHtml(images_list_html);
      $('#image-load').html(images_list_html);
      var chapter_images = saver.getImages($, page, '#image-load');
      if (options.verbose) console.log(chapter_images);

      if (options.verbose) {
      console.log('Options output dir : ' + options.output_dir);
      console.log('Page output dir    : ' + page.output_dir);
      }

      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: page.output_dir,
        // output_dir_name: output_dir_name
      }, options, function(err) {
        if (err) return callback(err);
        callback();
      });

    } else if ($('.manga-chapter').length) {
      console.log('Chapter list');
      
      // if (options.group_by_site) {
      //   options.output_dir = path.join(options.output_dir, 'Comicvn.net');
      //   saver.setMangaOutputDir(options.output_dir);
      // }

      if (options.auto_manga_dir) {
        var manga_title = $('.manga-info .sub-bor h1').first().text().trim();
        console.log('Manga title: ' + manga_title);
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);
      
      page.chapter_links = saver.getLinks($, page, '.manga-chapter');
      if (options.verbose) console.log(page.chapter_links);

      console.log(page.chapter_links.length + ' chapters');
      saver.processPages(page.chapter_links, options, function(err) {
        if (err) {
          return callback(err);
        }
        callback();
      });
    } else {
      callback();
    }
  }
}