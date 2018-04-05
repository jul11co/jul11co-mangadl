var path = require('path');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'Hocvientruyentranh',
  website: 'http://hocvientruyentranh.com',

  match: function(link, options) {
    return /hocvientruyentranh\.com/g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {
    
    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'Hocvientruyentranh');
      saver.setMangaOutputDir(options.output_dir);
    }

    if (page.url.indexOf('/manga/') > 0) {
      console.log('----');
      console.log('Manga page: ' + page.url);
      
      var manga_title = $('.box-manga .__info-container .__info h3.__name').text().trim();
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
      
      var chapter_links = saver.getLinks($, page, '.box .table-scroll', { 
        filters: ['/chapter/'] 
      });

      saver.downloadMangaChapters(chapter_links, options, callback);

    } else if (page.url.indexOf('/chapter/') > 0) {
      var chapter_title = utils.replaceAll(page.title.trim(), '| Học Viện Truyện Tranh', '').trim();

      var chapter_images = saver.getImages($, page, '.manga-container');
      if (options.verbose) console.log(chapter_images);

      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: page.output_dir
      }, options, callback);
    } else {
      callback();
    }
  }
}

var getMangaInfo = function($, page, options) {
  var manga_info = {};
  if (page.url.indexOf('/manga/') > 0 && $('.box-manga .__info-container').length) {
    manga_info.url = page.url;
    manga_info.name = $('.box-manga .__info-container .__info h3.__name').first().text().trim();
    manga_info.cover_image = $('.box-manga .__info-container .__left .__image img').attr('src');
    manga_info.description = $('.box-manga .__info-container .__info .__description').first().text().trim();
    
    $('.box-manga .__info-container .__info p').each(function() {
      var info_key = $(this).find('strong').first().text().trim();
      if (!info_key || info_key == '') return;

      if (info_key.indexOf('Tên khác:') == 0) {
        $(this).find('strong').remove();
        var alt_names_str = $(this).text().trim();
        var alt_names = alt_names_str.split('; ');
        manga_info.alt_names = alt_names.filter(function(alt_name) {
          return alt_name && alt_name != 'N/A';
        });
      } else if (info_key.indexOf('Tác giả:') == 0) {
        manga_info.authors = [];
        $(this).find('a').each(function() {
          manga_info.authors.push({
            name: $(this).text().trim(),
            url: $(this).attr('href')
          });
        });
      } else if (info_key.indexOf('Tình trạng:') == 0) {
        $(this).find('strong').remove();
        manga_info.status = $(this).text().trim();
      } else if (info_key.indexOf('Thể loại:') == 0) {
        manga_info.genres = [];
        $(this).find('a').each(function() {
          manga_info.genres.push({
            name: $(this).text().trim(),
            url: $(this).attr('href')
          });
        });
      } else if (info_key.indexOf('Nhóm dịch:') == 0) {
        manga_info.groups = [];
        $(this).find('a').each(function() {
          manga_info.groups.push({
            name: $(this).text().trim(),
            url: $(this).attr('href')
          });
        });
      }
    });

    var manga_chapters = [];
    $('.box .table-scroll tr').each(function() {
      var $chapter_link = $(this).find('td').first();
      manga_chapters.push({
        url: $chapter_link.children('a').attr('href'),
        title: $chapter_link.children('a').text().trim(),
        published_date_str: $(this).find('td').last().text().trim()
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