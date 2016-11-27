const wpapi = require('wpapi')
const moment = require('moment')
const firebase = require('firebase')

// environment variables see: https://github.com/motdotla/dotenv
require('dotenv').config({ silent: true })

// wpapi config
const domain = `https://${process.env.DOMAIN}/wp-json`
const wp = new wpapi({ endpoint: domain })

// firebase config
const config = {
  apiKey: process.env.apiKey,
  authDomain: process.env.authDomain,
  databaseURL: process.env.databaseURL,
  storageBucket: process.env.storageBucket,
  messagingSenderId: process.env.messagingSenderId
}
firebase.initializeApp(config)
const database = firebase.database()

let order = 1
let page = 1
let totalPages = 0

// insert all post into firebase
// 20 posts each call
;(function insertIntoFirebase(page) {
  // get all post from wpapi
  wp.posts().perPage(20).page(page).then((data) => {
    totalPages = data._paging.totalPages

    const posts = data.map((value) => {
      const renderedPost = {
        id: value.id,
        title: value.title.rendered,
        content: value.content.rendered.replace(new RegExp('http://', 'g'), 'https://'),
        date: moment(new Date(value.date)).format('MMMM DD, YYYY'),
        slug: value.slug,
        imageId: value.featured_media,
        image: '',
        order: order
      }

      // increase order value
      order += 1

      // insert each post into firebase
      database.ref(`/${value.id}`).set(renderedPost)

      return renderedPost
    })

    return posts
  }).then((posts) => {
    // get image api
    const getMedia = posts.map((value) => {
      return wp.media().id(value.imageId)
    })

    return Promise.all(getMedia)
  }).then((images) => {
    // update image url in firebase
    const featuredImage = images.map((value) => {
        database.ref(`/${value.post}`).update({
          image: value.source_url.replace('http://', 'https://')
        })
    })

    return 'done'
  }).then((done) => {
    console.log('done page:', page)

    if (page != totalPages) {
      insertIntoFirebase(page += 1)
    } else {
      console.log('all done')
    }
  }).catch((error) => {
    console.log(error)
  })
})(page)
