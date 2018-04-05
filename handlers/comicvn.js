var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

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

    if (page.url.indexOf('/chapter-') != -1 && $('iframe').length) {
      // var iframe_src = $('iframe').attr('src');
      var iframe_srcs = [];
      $('iframe').each(function() {
        var iframe_src = $(this).attr('src');
        if (iframe_src && iframe_src != '' && iframe_src.indexOf('comicvn.net') != -1) {
          iframe_srcs.push(iframe_src);
        }
      });
      iframe_srcs = iframe_srcs.filter(function(chapter_link) {
        return !saver.isDone(chapter_link);
      });
      saver.processPages(iframe_srcs, options, callback);
    }
    else if ($('.manga-chapter-image').length) {
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
      if (options.debug) console.log(chapter_images);

      if (options.debug) {
      console.log('Options output dir : ' + options.output_dir);
      console.log('Page output dir    : ' + page.output_dir);
      }

      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: page.output_dir,
        // output_dir_name: output_dir_name
      }, options, callback);

    } else if ($('.manga-chapter').length) {
      var manga_title = $('.manga-info .sub-bor h1').first().text().trim();
      console.log('Manga title: ' + manga_title);
      console.log('Chapter list');
      
      if (options.auto_manga_dir) {
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);
      if (options.save_index_html) {
        saver.saveHtmlSync(path.join(options.output_dir, 'index.html'), $.html());
      }
      var manga_info = getMangaInfo($, page, options);
      if (manga_info && manga_info.url) {
        saver.saveJsonSync(path.join(options.output_dir, 'manga.json'), manga_info);
      }
      
      var chapter_links = saver.getLinks($, page, '.manga-chapter');

      // chapter_links = chapter_links.map(function(chapter_link) {
      //   return chapter_link.replace('//comicvn.net/', '//imgur.comicvn.net/');
      // });

      chapter_links = chapter_links.filter(function(chapter_link) {
        return !saver.isDone(chapter_link) 
          && !saver.isDone(chapter_link.replace('//imgur.comicvn.net/','//comicvn.net/'));
      });

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  }
}

var getMangaInfo = function($, page, options) {
  var manga_info = {};
  if ($('.manga-chapter').length) {
    manga_info.url = page.url;
    manga_info.name = $('.manga-info .sub h1').first().text().trim();
    manga_info.cover_image = $('.manga-detail img').first().attr('src');
    manga_info.description = $('div.manga-summary').text().trim();

    $('.manga-detail ul li').each(function() {
      var info_key = $(this).find('span.font-bold.float-left').first().text().trim();
      if (!info_key || info_key == '') return;

      if (info_key == 'Tên khác') {
        $(this).find('span.font-bold').remove();
        var alt_names_str = $(this).text().trim();
        // alt_names_str = utils.replaceAll(alt_names_str, '\t', '').trim();
        // alt_names_str = utils.replaceAll(alt_names_str, '  ', '').trim();
        manga_info.alt_names = alt_names_str.split('; ').map(function(alt_name) {
          return alt_name.trim();
        });
      }
      else if (info_key == 'Tác giả') {
        $(this).find('span.font-bold').remove();
        manga_info.authors = [];
        $(this).find('span').each(function() {
          manga_info.authors.push($(this).text().trim());
        });
      } 
      else if (info_key == 'Họa sĩ') {
        $(this).find('span.font-bold').remove();
        manga_info.artists = [];
        $(this).find('span').each(function() {
          manga_info.artists.push($(this).text().trim());
        });
      }
      else if (info_key.indexOf('Trạng thái') == 0) {
        $(this).find('span.font-bold').remove();
        manga_info.status = $(this).text().trim();
      } else if (info_key.indexOf('Thể loại') == 0) {
        manga_info.genres = [];
        $(this).find('a').each(function() {
          manga_info.genres.push({
            name: $(this).text().trim(),
            url: $(this).attr('href')
          });
        });
      } 
      else if (info_key.indexOf('Loại') == 0) {
        $(this).find('span.font-bold').remove();
        manga_info.type_str = $(this).text().trim();
      } 
      else if (info_key.indexOf('Xuất bản') == 0) {
        $(this).find('span.font-bold').remove();
        manga_info.release_str = $(this).text().trim();
      }
    });

    var manga_chapters = [];
    $('.manga-chapter ul li a').each(function() {
      manga_chapters.push({
        url: $(this).attr('href'),
        title: $(this).text().trim(),
        published_date_str: $(this).parent().children('span.date').first().text().trim()
      });
    });

    manga_info.chapter_count = manga_chapters.length;
        
    if (options.include_chapters || options.with_chapters) {
      manga_info.chapters = manga_chapters;
    }
    
    if (options.verbose) {
      console.log('Manga:');
      console.log('    Name: ' + manga_info.name);
      console.log('    Cover image: ' + manga_info.cover_image);
      // console.log('    Description: ' + manga_info.description);
      console.log('    Authors: ' + manga_info.authors);
      console.log('    Genres: ' + manga_info.genres);
      console.log('    Status: ' + manga_info.status);
      console.log('    Chapter count: ' + manga_info.chapter_count);
    }
  }
  return manga_info;
}