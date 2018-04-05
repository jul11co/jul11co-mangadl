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

    if (page.url.indexOf('/c') > 0 &&  $('#viewer').length) {

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
      if (options.debug) console.log(chapter_images);

      var chapter_output_dir = '';
      chapter_output_dir = path.basename(page.output_dir);
      chapter_output_dir = path.join(options.output_dir, chapter_output_dir);
      
      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: chapter_output_dir
      }, options, callback);

    } else if (page.url.indexOf('/manga/') > 0 && $('#list').length && $('.chapter').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('.content .hd h1 a').first().text().trim();
      manga_title = utils.replaceAll(manga_title, ':', ' -');
      manga_title = utils.replaceAll(manga_title, '.', '_');
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

      $('#stream_1 .volume.collapsed').remove();

      var chapter_links = saver.getLinks($, page, '#stream_1 ul.chapter li', {
        blacklist: ['/1','/3-1','/6-1','/10-1'],
        filters: ['/manga/']
      });

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  }
}

var getMangaInfo = function($, page, options) {
  var manga_info = {};
  if (page.url.indexOf('/manga/') > 0 && $('#list').length && $('.chapter').length) {
    manga_info.url = page.url;
    manga_info.name = $('.content .hd h1 a').first().text().trim();
    manga_info.cover_image = $('.content .cover img').attr('src');
    if (manga_info.cover_image && manga_info.cover_image.indexOf('//') == 0) {
      manga_info.cover_image = 'https:' + manga_info.cover_image;
    }
    
    manga_info.description = $('p.summary').text().trim();

    $('.content table.attr tr').each(function() {
      var info_key = $(this).find('th').text().trim();

      if (info_key == 'Alternative') {
        var alt_names_str = $(this).children('td').text().trim();
        alt_names_str = utils.replaceAll(alt_names_str, '\t', '').trim();
        // alt_names_str = utils.replaceAll(alt_names_str, '  ', '').trim();
        manga_info.alt_names = alt_names_str.split('; ').map(function(alt_name) {
          return alt_name.trim();
        });
      }
      else if (info_key == 'Author(s)') {
        manga_info.authors = [];
        $(this).find('a').each(function() {
          manga_info.authors.push($(this).text().trim());
        });
      } 
      else if (info_key == 'Artist(s)') {
        manga_info.artists = [];
        $(this).find('a').each(function() {
          manga_info.artists.push($(this).text().trim());
        });
      }
      else if (info_key.indexOf('Status') == 0) {
        manga_info.status = $(this).children('td').text().trim();
      } else if (info_key.indexOf('Genre(s)') == 0) {
        manga_info.genres = [];
        $(this).find('a').each(function() {
          manga_info.genres.push({
            name: $(this).text().trim(),
            url: $(this).attr('href')
          });
        });
      } 
      else if (info_key.indexOf('Type') == 0) {
        manga_info.type_str = $(this).children('td').text().trim();
      } 
      else if (info_key.indexOf('Release') == 0) {
        manga_info.release_str = $(this).children('td').text().trim();
      } 
      else if (info_key.indexOf('Rank') == 0) {
        manga_info.rank_str = $(this).children('td').text().trim();
      }
      else if (info_key.indexOf('Rating') == 0) {
        manga_info.rating_str = $(this).children('td').text().trim();
      }
    });

    if ($('.content table.attr a.rss').length) {
      manga_info.rss_url = $('.content table.attr a.rss').attr('href');
    }
    
    var manga_chapters = [];
    $('#stream_1 .volume').first().children('ul.chapter').find('li').each(function() {
      manga_chapters.push({
        url: $(this).children('span').first().children('a').attr('href'),
        title: $(this).children('span').first().children('a').text().trim(),
        published_date_str: $(this).children('i').first().text().trim()
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