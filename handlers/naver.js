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
  
  name: 'Naver',
  website: 'http://comic.naver.com',

  match: function(link, options) {
    return /comic\.naver\.com\/webtoon\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'Naver');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    if (page.url.indexOf('comic.naver.com/webtoon/detail.nhn') > 0 
      &&  $('#comic_view_area .wt_viewer').length) {

      var chapter_title = $('.tit_area .view h3').first().text().trim();
      chapter_title = utils.replaceAll(chapter_title, '/', '-');
      chapter_title = removeLastChars(chapter_title, '.');

      // Get images on current page
      var chapter_images = [];
      $('#comic_view_area .wt_viewer img').each(function() {
        var image_src = $(this).attr('src');
        if (image_src) {
          chapter_images.push({
            src: image_src,
            file: path.basename(image_src)
          });
        }
      });
      if (options.debug) console.log(chapter_images);

      var chapter_output_dir = '';
      // chapter_output_dir = path.join(options.output_dir, 
      //   path.basename(path.dirname(page.output_dir)) + '-' + path.basename(page.output_dir));
      chapter_output_dir = path.join(options.output_dir, chapter_title);
      
      var download_options = Object.assign(options, {
        request_headers: {
          "Referer": page.url      
        }
      });

      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: chapter_output_dir
      }, download_options, callback);

    } else if (page.url.indexOf('comic.naver.com/webtoon/list.nhn') > 0 
      && $('.comicinfo').length && $('.viewList').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      $('.comicinfo .detail h2 span.wrt_nm').remove();
      var manga_title = $('.comicinfo .detail h2').first().text().trim();
      manga_title = removeLastChars(manga_title, '.');
      console.log('Manga title: ' + manga_title);
      if (options.debug) console.log('Chapter list');

      if (options.auto_manga_dir && page.url.indexOf('&page=') == -1) {
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      if (page.url.indexOf('&page=') == -1) {
        saver.setStateData('url', page.url);
        if (options.save_index_html) {
          saver.saveHtmlSync(path.join(options.output_dir, 'index.html'), $.html());
        }
        var manga_info = this.getMangaInfo($, page, options);
        if (manga_info && manga_info.url) {
          saver.saveJsonSync(path.join(options.output_dir, 'manga.json'), manga_info);
        }
      }

      if (options.update_info_only) {
        return callback();
      }

      var chapter_links = saver.getLinks($, page, '.viewList tr td', {
        filters: [
          'comic.naver.com/webtoon/detail.nhn'
        ]
      });

      chapter_links = chapter_links.filter(function(chapter_link) {
        return !saver.isDone(chapter_link.replace('https:', 'http:')); 
      });

      var chapter_list_pages = [];
      if ($('.paginate').length && $('.paginate .page_wrap a.next').length) {
        var next_link = $('.paginate .page_wrap a.next').attr('href');
        if (next_link && next_link != '') {
          chapter_list_pages.push(next_link);
        }
      }

      saver.downloadMangaChapters(chapter_links, options, function(err) {
        if (err) return callback(err);
        
        if (chapter_list_pages.length) {
          saver.processPages(chapter_list_pages, options, callback);
        } else {
          callback();
        }
      });
    } else {
      callback();
    }
  },

  getMangaInfo: function($, page, options) {
    var manga_info = {};
    if (page.url.indexOf('comic.naver.com/webtoon/list.nhn') > 0 
      && $('.comicinfo').length && $('.viewList').length) {
      manga_info.url = page.url;
      manga_info.name = $('.comicinfo .detail h2').first().text().trim();
      manga_info.cover_image = $('.comicinfo .thumb img').first().attr('src');
      manga_info.description = $('.comicinfo .detail p').first().text().trim();

      if (options.verbose) {
        console.log('Manga:');
        console.log('    Name: ' + manga_info.name);
        console.log('    Cover image: ' + manga_info.cover_image);
        // console.log('    Description: ' + manga_info.description);
        // console.log('    Authors: ' + manga_info.authors);
        // console.log('    Genres: ' + manga_info.genres);
        // console.log('    Status: ' + manga_info.status);
        // console.log('    Chapter count: ' + manga_info.chapter_count);
      }
    }
    return manga_info;
  }
}
