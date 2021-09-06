import * as RDF from 'rdf-js';
import { getResourceAsDataset, getDataset } from '../Retrieval/retrieval';
import { Level, log } from '../Utils/Logger';
import { Filter } from '../Utils/util';
const factory = require('rdf-ext')
const SHACLValidator = require('rdf-validate-shacl')

const streamifyArray = require('streamify-array');


export async function validate( notificationDataset: any, shapesDataset: any) {  

  const validator = new SHACLValidator(shapesDataset, { factory })
  const report = await validator.validate(notificationDataset)

  log(Level.Log, `Shape conforms: ${report.conforms}, report length: ${report.results.length}`)
  for (const result of report.results) {
    // See https://www.w3.org/TR/shacl/#results-validation-result for details
    // about each property
    log(Level.Log, result.message)
    // console.log(result.path)
    // console.log(result.focusNode)
    // console.log(result.severity)
    // console.log(result.sourceConstraintComponent)
    // console.log(result.sourceShape)
  }
  return report.conforms
}

export async function validateFilters(quads: RDF.Quad[], filters: Filter[]) {
  let validatedFilters : Filter[] = []
  for (let filter of filters) {
    if (!filter.name) throw new Error('No name parameter set for used filter.')
    if (filter.shape) throw new Error('Shapes are currently not yet supported.')
    if (!filter.shapeFileURI) throw new Error('No shapeFileURI parameter set for filter.')

    // These have to be done every time, as the stream is consumed. (Is the dataset consumed? TODO:: check)
    const shapeDataset = await getResourceAsDataset(fetch, filter.shapeFileURI)
    const quadStream = await streamifyArray(quads.slice()); // Slicing is required, as else the array is consumed when running in the browser (but not when running in node?)
    const notificationDataset = await getDataset(quadStream)

    if(await validate(notificationDataset, shapeDataset)) {
      validatedFilters.push(filter)
    }
  }            
  return validatedFilters;
}