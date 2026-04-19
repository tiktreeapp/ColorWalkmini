const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

function detectContentType(buffer) {
  if (!buffer || buffer.length < 4) return 'application/octet-stream'
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png'
  }
  // JPEG: FF D8
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return 'image/jpeg'
  }
  return 'application/octet-stream'
}

function readAscii(buffer, offset, len) {
  return buffer.toString('ascii', offset, offset + len)
}

function getUint16(buffer, offset, littleEndian) {
  return littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset)
}

function getUint32(buffer, offset, littleEndian) {
  return littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset)
}

function readRational(buffer, offset, littleEndian) {
  const num = getUint32(buffer, offset, littleEndian)
  const den = getUint32(buffer, offset + 4, littleEndian)
  if (!den) return 0
  return num / den
}

function parseJpegGps(buffer) {
  // Only JPEG with EXIF APP1 is supported here.
  if (!buffer || buffer.length < 4) return null
  if (!(buffer[0] === 0xff && buffer[1] === 0xd8)) return null

  let offset = 2
  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== 0xff) break
    const marker = buffer[offset + 1]
    // SOS or EOI
    if (marker === 0xda || marker === 0xd9) break
    const size = buffer.readUInt16BE(offset + 2)
    if (size < 2) break

    if (marker === 0xe1 && size >= 10) {
      const exifOffset = offset + 4
      if (readAscii(buffer, exifOffset, 6) !== 'Exif\0\0') {
        offset += 2 + size
        continue
      }

      const tiffOffset = exifOffset + 6
      const endian = readAscii(buffer, tiffOffset, 2)
      const littleEndian = endian === 'II'
      if (!(littleEndian || endian === 'MM')) return null
      const magic = getUint16(buffer, tiffOffset + 2, littleEndian)
      if (magic !== 0x002a) return null

      const ifd0Offset = getUint32(buffer, tiffOffset + 4, littleEndian)
      let dirOffset = tiffOffset + ifd0Offset
      if (dirOffset + 2 > buffer.length) return null
      const numEntries = getUint16(buffer, dirOffset, littleEndian)
      dirOffset += 2

      let gpsIfdPtr = 0
      for (let i = 0; i < numEntries; i += 1) {
        const entryOff = dirOffset + i * 12
        if (entryOff + 12 > buffer.length) break
        const tag = getUint16(buffer, entryOff, littleEndian)
        if (tag === 0x8825) {
          gpsIfdPtr = getUint32(buffer, entryOff + 8, littleEndian)
          break
        }
      }
      if (!gpsIfdPtr) return null

      let gpsOffset = tiffOffset + gpsIfdPtr
      if (gpsOffset + 2 > buffer.length) return null
      const gpsEntries = getUint16(buffer, gpsOffset, littleEndian)
      gpsOffset += 2

      let latRef = 'N'
      let lonRef = 'E'
      let latValOffset = 0
      let lonValOffset = 0
      for (let i = 0; i < gpsEntries; i += 1) {
        const entryOff = gpsOffset + i * 12
        if (entryOff + 12 > buffer.length) break
        const tag = getUint16(buffer, entryOff, littleEndian)
        const type = getUint16(buffer, entryOff + 2, littleEndian)
        const count = getUint32(buffer, entryOff + 4, littleEndian)
        const valueOrOffset = entryOff + 8

        if (tag === 0x0001 && type === 2 && count >= 1) {
          latRef = String.fromCharCode(buffer[valueOrOffset])
        } else if (tag === 0x0003 && type === 2 && count >= 1) {
          lonRef = String.fromCharCode(buffer[valueOrOffset])
        } else if (tag === 0x0002 && type === 5 && count === 3) {
          latValOffset = getUint32(buffer, valueOrOffset, littleEndian)
        } else if (tag === 0x0004 && type === 5 && count === 3) {
          lonValOffset = getUint32(buffer, valueOrOffset, littleEndian)
        }
      }
      if (!latValOffset || !lonValOffset) return null

      const latBase = tiffOffset + latValOffset
      const lonBase = tiffOffset + lonValOffset
      if (latBase + 24 > buffer.length || lonBase + 24 > buffer.length) return null

      const latDeg = readRational(buffer, latBase, littleEndian)
      const latMin = readRational(buffer, latBase + 8, littleEndian)
      const latSec = readRational(buffer, latBase + 16, littleEndian)
      const lonDeg = readRational(buffer, lonBase, littleEndian)
      const lonMin = readRational(buffer, lonBase + 8, littleEndian)
      const lonSec = readRational(buffer, lonBase + 16, littleEndian)

      let lat = latDeg + latMin / 60 + latSec / 3600
      let lon = lonDeg + lonMin / 60 + lonSec / 3600
      if (latRef === 'S') lat = -lat
      if (lonRef === 'W') lon = -lon

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
      return { lat, lon }
    }

    offset += 2 + size
  }

  return null
}

function stripCnSuffix(value) {
  if (!value || typeof value !== 'string') return ''
  return value
    .replace(/(省|市|特别行政区)$/g, '')
    .replace(/自治区$/g, '')
    .trim()
}

function reverseGeocodeInfo(lat, lon) {
  const key = process.env.QQMAP_KEY
  if (!key) return Promise.resolve(null)
  const url = `https://apis.map.qq.com/ws/geocoder/v1/?location=${lat},${lon}&get_poi=1&poi_options=radius%3D1000%3Bpolicy%3D2&key=${encodeURIComponent(key)}`
  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        try {
          const json = JSON.parse(data || '{}')
          if (typeof json.status === 'number' && json.status !== 0) {
            resolve(null)
            return
          }
          const ac = (json && json.result && json.result.address_component) || {}
          const nationRaw = (ac && ac.nation) || ''
          const provinceRaw = (ac && ac.province) || ''
          const cityRaw = (ac && ac.city) || ''
          const districtRaw = (ac && ac.district) || ''
          const recommend =
            (json &&
              json.result &&
              json.result.formatted_addresses &&
              json.result.formatted_addresses.recommend) ||
            ''

          const nation = stripCnSuffix(String(nationRaw || ''))
          const province = stripCnSuffix(String(provinceRaw || ''))
          const city = stripCnSuffix(String(cityRaw || ''))
          const district = String(districtRaw || '').trim()
          const place = String(recommend || district || '').trim()

          const poiTitle =
            (json && json.result && json.result.pois && json.result.pois[0] && json.result.pois[0].title) || ''
          const poi = String(poiTitle || '').trim()

          // Requirement: city · POI
          const cityName = city || province || nation
          const locationText = [cityName, poi || place || district].filter(Boolean).join('·')

          resolve({
            nation,
            province,
            city,
            district,
            place,
            poi,
            locationText,
          })
        } catch (e) {
          resolve(null)
        }
      })
    })
    req.on('error', () => resolve(null))
    req.setTimeout(1200, () => {
      try {
        req.destroy()
      } catch (e) {
        // ignore
      }
      resolve(null)
    })
  })
}

async function reverseGeocodeCity(lat, lon) {
  const info = await reverseGeocodeInfo(lat, lon)
  return info && info.city ? info.city : ''
}

exports.main = async (event) => {
  const { fileID } = event || {}
  const debug = !!(event && event.debug)
  const needCity = !!(event && event.needCity)
  const action = (event && event.action) || ''

  if (action === 'reverseGeocode') {
    const lat = event && typeof event.lat === 'number' ? event.lat : NaN
    const lon = event && typeof event.lon === 'number' ? event.lon : NaN
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { ok: false, kind: 'error', code: 'MISSING_COORDS', message: 'lat/lon is required' }
    }
    const info = await reverseGeocodeInfo(lat, lon)
    const city = (info && info.city) || ''
    const locationText = (info && info.locationText) || ''
    if (debug) {
      console.log('[ColorWalk] reverseGeocode', {
        lat,
        lon,
        city: city || '',
        locationText: locationText || '',
        hasKey: !!process.env.QQMAP_KEY,
      })
    }
    return { ok: true, city, locationText }
  }

  if (!fileID) {
    return { ok: false, code: 'MISSING_FILE_ID', message: 'fileID is required' }
  }

  try {
    if (debug) {
      console.log('[ColorWalk] imgSecCheck start', { fileID })
    }
    const downloadResult = await cloud.downloadFile({ fileID })
    const mediaBuffer = downloadResult.fileContent

    if (!mediaBuffer || !mediaBuffer.length) {
      return { ok: false, kind: 'error', code: 'EMPTY_MEDIA', message: 'empty media content' }
    }

    // Defensive limit: pre-check size to avoid spending time on OpenAPI calls that will be rejected.
    // imgSecCheck has a strict max payload size; keep this conservative.
    const maxBytes = 1024 * 1024
    if (mediaBuffer.length > maxBytes) {
      return { ok: false, kind: 'error', code: 40006, message: 'invalid media size' }
    }

    await cloud.openapi.security.imgSecCheck({
      media: {
        contentType: detectContentType(mediaBuffer),
        value: mediaBuffer,
      },
    })

    if (debug) {
      console.log('[ColorWalk] imgSecCheck ok', { fileID })
    }
    const resp = { ok: true }
    if (needCity) {
      const gps = parseJpegGps(mediaBuffer)
      if (gps) {
        const city = await reverseGeocodeCity(gps.lat, gps.lon)
        if (city) {
          return { ...resp, city }
        }
      }
    }
    return resp
  } catch (error) {
    console.error('[ColorWalk] imgSecCheck fail', { fileID, error })
    const message =
      (error && (error.errMsg || error.message)) || 'image security check failed'
    const code = (error && (error.errCode || error.code)) || 'SECURITY_CHECK_FAIL'
    const isRisk = code === 87014 || /risky/i.test(message)
    return {
      ok: false,
      kind: isRisk ? 'risk' : 'error',
      code,
      message,
    }
  }
}
