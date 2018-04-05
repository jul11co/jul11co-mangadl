var path = require('path');
var urlutil = require('url');

var moment = require('moment');

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
      console.log('Chapter page:', chapter_url);

      var chapter_title = $('.info-top-chapter h2').first().text().trim();
      chapter_title = utils.replaceAll(chapter_title, ':', ' -');
      chapter_title = utils.replaceAll(chapter_title, '.', '_');

      console.log('Chapter title:', chapter_title);

      var chapter_images = saver.getImages($, page, '#vungdoc');
      if (options.verbose) console.log(chapter_images);

      var chapter_url_obj = urlutil.parse(chapter_url);
      var output_dir_name = path.basename(chapter_url_obj.pathname);
      // var output_dir_name = path.basename(path.dirname(chapter_url_obj.pathname));
      var chapter_output_dir = path.join((options.output_dir || '.'), output_dir_name);
      
      if (options.debug) {
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
      }, options, callback);

    } else if (page.url.indexOf('/manga/') > 0 && $('#chapter').length && $('.chapter-list').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('.manga-info-text h1').first().text().trim();
      manga_title = utils.replaceAll(manga_title, ':', ' -');
      manga_title = removeLastChars(manga_title, '.');
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
      
      var chapter_links = saver.getLinks($, page, '#chapter .chapter-list', {
        filters: [ '/chapter/' ]
      });

      chapter_links = chapter_links.filter(function(chapter_link) {
        return !saver.isDone(chapter_link.replace('mangakakalot.com','manganelo.com'));
      });

      saver.downloadMangaChapters(chapter_links, options, callback);

    } else {
      callback();
    }
  }
}

var getMangaInfo = function($, page, options) {
  var manga_info = {};
  if (page.url.indexOf('/manga/') > 0 && $('#chapter').length && $('.chapter-list').length) {
    manga_info.url = page.url;
    manga_info.name = $('.manga-info-text li h1').first().text().trim();
    manga_info.cover_image = $('.manga-info-pic img').attr('src');
    
    $('#noidungm h2').first().remove();
    manga_info.description = $('#noidungm').text().trim();

    if ($('.manga-info-text li span.story-alternative').length) {
      var alt_names_str = $('.manga-info-text li span.story-alternative').text().trim();
      alt_names_str = alt_names_str.replace('Alternative : ', '').trim();
      manga_info.alt_names = alt_names_str.split('; ');
    }

    $('.manga-info-text li').each(function() {
      var info_str = $(this).text().trim();

      if (info_str.indexOf('Author(s) :') == 0) {
        manga_info.authors = [];
        $(this).find('a').each(function() {
          manga_info.authors.push($(this).text().trim());
        });
      } else if (info_str.indexOf('Status :') == 0) {
        manga_info.status = info_str.replace('Status :','').trim();
      } else if (info_str.indexOf('Genres :') == 0) {
        manga_info.genres = [];
        $(this).find('a').each(function() {
          manga_info.genres.push({
            name: $(this).text().trim(),
            url: $(this).attr('href')
          });
        });
      } else if (info_str.indexOf('TransGroup :') == 0) {

      } else if (info_str.indexOf('View :') == 0) {
        var views_str = info_str.replace('View :','').trim();
        views_str = utils.replaceAll(views_str,',','');
        manga_info.views = parseInt(views_str);
      } else if (info_str.indexOf('Rating :') == 0) {

      } else if (info_str.indexOf('Last updated :') == 0) {
        var last_updated_str = info_str.replace('Last updated :','').trim();
        var last_updated_moment = moment(last_updated_str, 'MMM-DD-YYYY hh:mm:ss A');
        if (last_updated_moment.isValid()) {
          manga_info.last_updated = last_updated_moment.toDate();
        }
      }
    });
    
    var manga_chapters = [];
    $('#chapter .chapter-list div.row').each(function() {
      manga_chapters.push({
        url: $(this).children('span').first().children('a').attr('href'),
        title: $(this).children('span').first().children('a').text().trim(),
        published_date_str: $(this).children('span').last().text().trim()
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