# Larger warehouse page format

`larger-warehouse-reference.md` preserves the High Point page as of October 9,
2026. It is a reference outside the live content collection and is not published.
The original High Point entry also remains in **Admin → Locations → High Point**
with **Published on Website** turned off.

For a new larger building, copy this reference into `src/content/locations/` with
a new filename and slug, or duplicate the unpublished High Point entry in the
CMS. Keep it unpublished while entering the new property's details.

Preserve `propertyType: warehouse` and the section structure: hero headline and
subtitle, photo/concept gallery with captions and image types, building and yard
highlights, specifications, space and availability, local guide, FAQs, map/address,
and inquiry call to action. These fields use the existing shared
`src/components/PropertyPage.astro` layout and property styles.

Replace every High Point-specific name, address, image, caption, size, yard detail,
rent, renovation statement, availability, SEO field, FAQ, and body paragraph.
Do not reuse its property claims or images for a different building. Use confirmed
facts and leave unknown optional details blank; label renderings as renderings.
Set the publication switch only when the new property's content is ready, then
run the production build and publish through the normal PR workflow.

Potential future listing supplied by the owner: **1108 9th Ave NE, Hickory, NC**.
No replacement listing has been created; property details and photos still need
to be supplied before publishing it.
